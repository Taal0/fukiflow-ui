import { useEffect, useRef } from 'react'
import { ApiError, api } from '@/api/client'
import { useSavePageEditMutation } from '@/api/queries'
import type { PageEdit } from '@/api/types'
import { editPayload } from '@/lib/workingDoc'
import { useSession } from '@/store/session'

const DEBOUNCE_MS = 800

/** Stable JSON for deep compare — key order must not affect equality. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(obj).sort()) sorted[k] = obj[k]
      return sorted
    }
    return v
  })
}

/** Content fingerprint — rev excluded so a successful bump doesn't look like a new edit. */
function contentFingerprint(edit: PageEdit): string {
  return stableStringify({
    page: edit.page ?? {},
    bubbles: edit.bubbles ?? {},
    paint: edit.paint ?? [],
  })
}

/**
 * Persist dirty PageEdit overlays.
 *
 * Serial per page: never abort an in-flight PUT. After success, if still dirty,
 * schedule another debounced save (never tight-loop in finally).
 * On 409: adopt server rev, keep local content, retry once.
 */
export function useAutosave() {
  const dirtyKey = useSession((s) => {
    const parts: string[] = []
    for (const [id, page] of Object.entries(s.pages)) {
      if (!page.dirty) continue
      parts.push(`${id}:${contentFingerprint(page.edit)}`)
    }
    return parts.sort().join(';;')
  })
  const markSaving = useSession((s) => s.markSaving)
  const markSaved = useSession((s) => s.markSaved)
  const markSaveError = useSession((s) => s.markSaveError)
  const syncRevFromServer = useSession((s) => s.syncRevFromServer)
  const mutation = useSavePageEditMutation()

  const timerByPage = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  )
  const inFlight = useRef<Set<number>>(new Set())
  const pendingAfterFlight = useRef<Set<number>>(new Set())
  const lastSavedContent = useRef<Map<number, string>>(new Map())
  const savePageRef = useRef<(pageId: number, retry?: boolean) => Promise<void>>(
    async () => {},
  )

  const scheduleSave = (pageId: number) => {
    const existing = timerByPage.current.get(pageId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      timerByPage.current.delete(pageId)
      void savePageRef.current(pageId)
    }, DEBOUNCE_MS)
    timerByPage.current.set(pageId, timer)
  }

  savePageRef.current = async (pageId: number, allowConflictRetry = true) => {
    if (inFlight.current.has(pageId)) {
      pendingAfterFlight.current.add(pageId)
      return
    }

    const current = useSession.getState().pages[pageId]
    if (!current?.dirty) return

    const contentFp = contentFingerprint(current.edit)
    if (lastSavedContent.current.get(pageId) === contentFp) {
      // Content already on server — clear dirty without another PUT.
      markSaved(pageId, current.edit)
      return
    }

    inFlight.current.add(pageId)
    pendingAfterFlight.current.delete(pageId)
    markSaving(pageId)

    const expectedRev = current.edit.rev
    const payload = editPayload(current.edit)
    let skipFlush = false

    try {
      const result = await mutation.mutateAsync({
        pageId,
        rev: expectedRev,
        edit: payload,
      })
      lastSavedContent.current.set(pageId, contentFingerprint(result.edit))
      markSaved(pageId, result.edit)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        skipFlush = true
        return
      }

      if (err instanceof ApiError && err.status === 409 && allowConflictRetry) {
        try {
          const latest = await api.getPageEdit(pageId)
          syncRevFromServer(pageId, latest.rev)
          inFlight.current.delete(pageId)
          skipFlush = true
          await savePageRef.current(pageId, false)
          return
        } catch (resyncErr: unknown) {
          const msg =
            resyncErr instanceof Error
              ? resyncErr.message
              : 'Kayıt çakışması çözülemedi'
          markSaveError(pageId, msg)
          skipFlush = true
          return
        }
      }

      const msg =
        err instanceof ApiError
          ? err.status === 409
            ? 'Kayıt çakışması — tekrar denendi, yine olmadı'
            : err.message
          : err instanceof Error
            ? err.message
            : 'Kayıt başarısız'
      markSaveError(pageId, msg)
      skipFlush = true
    } finally {
      inFlight.current.delete(pageId)
      if (skipFlush) return

      if (pendingAfterFlight.current.has(pageId)) {
        pendingAfterFlight.current.delete(pageId)
        const again = useSession.getState().pages[pageId]
        if (again?.dirty) scheduleSave(pageId)
        return
      }

      const again = useSession.getState().pages[pageId]
      if (
        again?.dirty &&
        again.saveStatus !== 'error' &&
        lastSavedContent.current.get(pageId) !== contentFingerprint(again.edit)
      ) {
        // Debounce — never tight-loop on stillDirty from key-order mismatches.
        scheduleSave(pageId)
      }
    }
  }

  useEffect(() => {
    if (!dirtyKey) return

    const pages = useSession.getState().pages
    for (const [idStr, page] of Object.entries(pages)) {
      if (!page.dirty) continue
      const pageId = Number(idStr)
      const fp = contentFingerprint(page.edit)
      if (lastSavedContent.current.get(pageId) === fp) continue

      if (inFlight.current.has(pageId)) {
        pendingAfterFlight.current.add(pageId)
        continue
      }

      scheduleSave(pageId)
    }
  }, [dirtyKey])

  useEffect(() => {
    return () => {
      for (const t of timerByPage.current.values()) clearTimeout(t)
      timerByPage.current.clear()
    }
  }, [])
}
