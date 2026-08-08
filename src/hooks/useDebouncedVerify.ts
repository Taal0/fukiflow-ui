import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from '@/api/client'
import {
  applyPageEditToCache,
  injectPromotedIntoCache,
  invalidateChapterOverlayLists,
} from '@/api/pageCache'
import type { PageDetail, Region } from '@/api/types'
import { useSession } from '@/store/session'

const VERIFY_DEBOUNCE_MS = 4000

function pendingRegions(regions: Region[] | undefined): Region[] {
  // Only never-tried bubble-kind boxes. sfx/other skip YOLO; unconfirmed
  // already failed — retry only after text/bbox edit resets to unclassified.
  return (regions ?? []).filter(
    (r) =>
      (r.kind ?? 'bubble') === 'bubble' &&
      r.status === 'unclassified' &&
      Boolean(r.text?.trim()),
  )
}

function regionsFingerprint(pageId: number, regions: Region[]): string {
  const parts = regions
    .map((r) => `${r.id}:${r.text}:${r.bbox.join(',')}`)
    .sort()
  return `${pageId}|${parts.join(';')}`
}

export function useDebouncedVerify(detail: PageDetail | undefined) {
  const pageId = detail?.page.id
  const pageSession = useSession((s) =>
    pageId != null ? s.pages[pageId] : undefined,
  )
  const updateRegionStatus = useSession((s) => s.updateRegionStatus)
  const applyVerifyEdit = useSession((s) => s.applyVerifyEdit)
  const qc = useQueryClient()

  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const regions = pageSession?.edit.regions
  const toVerify = pendingRegions(regions)
  const fingerprint =
    pageId != null && toVerify.length > 0
      ? regionsFingerprint(pageId, toVerify)
      : ''

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSentRef = useRef<string>('')
  const inFlightFpRef = useRef<string | null>(null)
  const prevPageRef = useRef<number | undefined>(undefined)

  const runVerify = useCallback(
    (opts?: { force?: boolean }) => {
      if (!detail || pageId == null) return

      const session = useSession.getState().pages[pageId]
      const pendingNow = pendingRegions(session?.edit.regions)
      if (!pendingNow.length) return

      const fp = regionsFingerprint(pageId, pendingNow)
      if (!opts?.force) {
        if (fp === lastSentRef.current) return
        if (fp === inFlightFpRef.current) return
      }

      if (timerRef.current) clearTimeout(timerRef.current)
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      inFlightFpRef.current = fp
      setPending(true)

      for (const r of pendingNow) {
        updateRegionStatus(pageId, r.id, 'verifying')
      }

      const flushThenVerify = async () => {
        const sessionNow = useSession.getState().pages[pageId]
        if (sessionNow?.dirty) {
          try {
            const saved = await api.putPageEdit(pageId, {
              rev: sessionNow.edit.rev,
              edit: sessionNow.edit,
              user_id: 'translator',
            })
            useSession.getState().markSaved(pageId, saved.edit)
            applyPageEditToCache(qc, pageId, {
              edit: saved.edit,
              rev: saved.rev,
              author: saved.author,
            })
          } catch (err) {
            // Continue verify with last server state if save fails (409 etc.)
            if (err instanceof ApiError && err.status === 409) {
              throw err
            }
          }
        }
        return api.verifyRegions(pageId, { signal: ac.signal })
      }

      flushThenVerify()
        .then((result) => {
          if (ac.signal.aborted) return
          lastSentRef.current = fp
          inFlightFpRef.current = null

          applyVerifyEdit(pageId, result.edit)
          applyPageEditToCache(qc, pageId, {
            edit: result.edit,
            rev: result.rev,
            author: 'verify',
          })

          const bubbles = [
            ...(result.promoted ?? []),
            ...(result.additional_bubbles ?? []),
          ]
          if (bubbles.length) {
            injectPromotedIntoCache(qc, pageId, {
              bubbles,
              layer_assets: result.layer_assets ?? [],
            })
            void qc.invalidateQueries({ queryKey: ['pages', pageId] })
          }

          invalidateChapterOverlayLists(qc)
          setError(null)
          setPending(false)
        })
        .catch((err: unknown) => {
          if (ac.signal.aborted) return
          if (err instanceof DOMException && err.name === 'AbortError') return
          inFlightFpRef.current = null
          const sessionNow = useSession.getState().pages[pageId]
          for (const r of sessionNow?.edit.regions ?? []) {
            if (r.status === 'verifying') {
              updateRegionStatus(pageId, r.id, 'unclassified')
            }
          }
          const msg =
            err instanceof ApiError
              ? err.status === 503
                ? 'Doğrulama servisi şu an kapalı'
                : err.status === 409
                  ? 'Kayıt çakışması — doğrulama ertelendi'
                  : err.message
              : err instanceof Error
                ? err.message
                : 'Doğrulama başarısız'
          setError(msg)
          setPending(false)
        })
    },
    [detail, pageId, updateRegionStatus, applyVerifyEdit, qc],
  )

  // Flush verify when leaving a page that still has pending regions.
  useEffect(() => {
    const prev = prevPageRef.current
    prevPageRef.current = pageId
    if (prev != null && prev !== pageId) {
      const session = useSession.getState().pages[prev]
      const leftover = pendingRegions(session?.edit.regions)
      if (leftover.length) {
        // Fire-and-forget for the page we left (no AbortController share).
        void api.verifyRegions(prev).then((result) => {
          useSession.getState().applyVerifyEdit(prev, result.edit)
          applyPageEditToCache(qc, prev, {
            edit: result.edit,
            rev: result.rev,
            author: 'verify',
          })
          const bubbles = [
            ...(result.promoted ?? []),
            ...(result.additional_bubbles ?? []),
          ]
          if (bubbles.length) {
            injectPromotedIntoCache(qc, prev, {
              bubbles,
              layer_assets: result.layer_assets ?? [],
            })
            void qc.invalidateQueries({ queryKey: ['pages', prev] })
          }
          invalidateChapterOverlayLists(qc)
        }).catch(() => {
          /* leave status as-is; user can return and retry */
        })
      }
    }
  }, [pageId, qc])

  useEffect(() => {
    if (!detail || pageId == null) return
    if (!fingerprint) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    if (fingerprint === lastSentRef.current) return
    if (fingerprint === inFlightFpRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)
    setPending(true)
    timerRef.current = setTimeout(() => {
      runVerify()
    }, VERIFY_DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [detail, pageId, fingerprint, runVerify])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { pending, error, isError: Boolean(error), runVerify }
}
