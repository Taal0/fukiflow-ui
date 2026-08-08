import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import { useTypesetMutation } from '@/api/queries'
import type { BBox, PageDetail } from '@/api/types'
import { buildTypesetBody } from '@/lib/workingDoc'
import {
  pageFontFromEdit,
  typesetTriggerFromEdit,
  useSession,
} from '@/store/session'

const DEBOUNCE_MS = 350

function editFingerprint(
  pageId: number,
  edit: ReturnType<typeof typesetTriggerFromEdit> extends infer T
    ? T
    : never,
  pageFontKey: string,
): string {
  return `${pageId}|${JSON.stringify(edit.text)}|${JSON.stringify(edit.scales)}|${JSON.stringify(edit.fonts)}|${JSON.stringify(edit.fontPx)}|${JSON.stringify(edit.leading)}|${JSON.stringify(edit.align)}|${pageFontKey}`
}

export function useDebouncedTypeset(detail: PageDetail | undefined) {
  const selectedPageId = useSession((s) => s.selectedPageId)
  // Never typeset against a stale detail from another page (same bubble ids
  // across re-uploads would write layouts onto the wrong manga).
  const pageId =
    detail != null &&
    selectedPageId != null &&
    detail.page.id === selectedPageId
      ? selectedPageId
      : undefined
  const pageSession = useSession((s) =>
    pageId != null ? s.pages[pageId] : undefined,
  )
  const applyTypeset = useSession((s) => s.applyTypeset)
  const clearTypeset = useSession((s) => s.clearTypeset)
  const mutation = useTypesetMutation()
  const mutateRef = useRef(mutation.mutateAsync)
  mutateRef.current = mutation.mutateAsync

  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const edit = pageSession?.edit
  const trigger = typesetTriggerFromEdit(edit)
  const pageFontKey = pageFontFromEdit(edit) ?? ''

  // Frame intentionally omitted — dragging mid-gesture must not auto-reflow.
  const fingerprint =
    pageId != null ? editFingerprint(pageId, trigger, pageFontKey) : ''
  const baseline = pageId != null ? `${pageId}|{}|{}|{}|{}|{}|{}|` : ''
  const needsTypeset = Boolean(detail && pageId != null && fingerprint !== baseline)

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSentRef = useRef<string>('')
  const inFlightFpRef = useRef<string | null>(null)

  const runTypeset = useCallback(
    (opts?: {
      forceBubbleIds?: number[]
      forceOverrides?: Record<number, { font_px?: number; frame?: BBox }>
      /** Bypass fingerprint short-circuit (explicit Oto dizgi / frame commit). */
      force?: boolean
    }) => {
      if (!detail || pageId == null) return

      const session = useSession.getState().pages[pageId]
      const fp = editFingerprint(
        pageId,
        typesetTriggerFromEdit(session?.edit),
        pageFontFromEdit(session?.edit) ?? '',
      )

      // Skip duplicate in-flight / already-applied unless forced.
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

      const body = buildTypesetBody(detail, session, undefined, opts)

      mutateRef
        .current({ pageId, body, signal: ac.signal })
        .then((result) => {
          if (ac.signal.aborted) return
          lastSentRef.current = fp
          inFlightFpRef.current = null
          applyTypeset(pageId, result.layouts ?? [], result.text_layers ?? [])
          setError(null)
          setPending(false)
        })
        .catch((err: unknown) => {
          if (ac.signal.aborted) return
          if (err instanceof DOMException && err.name === 'AbortError') return
          inFlightFpRef.current = null
          const msg =
            err instanceof ApiError
              ? err.status === 503
                ? 'Dizgi servisi şu an kapalı; görüntüleme çalışmaya devam ediyor'
                : err.message
              : err instanceof Error
                ? err.message
                : 'Dizgi başarısız'
          setError(msg)
          setPending(false)
        })
    },
    [detail, pageId, applyTypeset],
  )

  useEffect(() => {
    if (!detail || pageId == null) return

    if (!needsTypeset) {
      if (timerRef.current) clearTimeout(timerRef.current)
      abortRef.current?.abort()
      inFlightFpRef.current = null
      const session = useSession.getState().pages[pageId]
      if (
        session &&
        (session.textLayers || Object.keys(session.layoutsByBubble).length > 0)
      ) {
        const hasFrame = Object.values(session.edit.bubbles).some((b) => b.frame)
        if (!hasFrame) clearTypeset(pageId)
      }
      lastSentRef.current = ''
      setPending(false)
      setError(null)
      return
    }

    if (fingerprint === lastSentRef.current) return
    if (fingerprint === inFlightFpRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)
    setPending(true)

    timerRef.current = setTimeout(() => {
      runTypeset()
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, pageId, fingerprint, needsTypeset])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const runTypesetForced = useCallback(
    (opts?: {
      forceBubbleIds?: number[]
      forceOverrides?: Record<number, { font_px?: number; frame?: BBox }>
    }) => runTypeset({ ...opts, force: true }),
    [runTypeset],
  )

  return { pending, error, isError: Boolean(error), runTypeset: runTypesetForced }
}
