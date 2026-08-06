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
    regions: edit.regions ?? [],
    order: edit.order ?? [],
  })
}

  /**
   * Persist dirty PageEdit overlays across the whole app (any role view).
   *
   * Serial per page: never abort an in-flight PUT. After success, if still dirty,
   * schedule another debounced save (never tight-loop in finally).
   * On 409: surface conflict UI (keep local visible; stash server copy) — no
   * silent last-write-wins. User chooses take-server or keep-mine.
   *
   * Unmount flushes pending debounce timers so a quick role/route switch still
   * lands the write.
   *
   * Returns ``retrySave`` for the toolbar when saveStatus is error.
   */
export function useAutosave(opts?: { userId?: string | null }) {
  const userId = opts?.userId ?? null
  const dirtyKey = useSession((s) => {
    const parts: string[] = []
    for (const [id, page] of Object.entries(s.pages)) {
      if (!page.dirty) continue
      // Don't autosave while a conflict is awaiting user choice.
      if (page.saveStatus === 'conflict') continue
      parts.push(`${id}:${contentFingerprint(page.edit)}`)
    }
    return parts.sort().join(';;')
  })
  const markSaving = useSession((s) => s.markSaving)
  const markSaved = useSession((s) => s.markSaved)
  const markSaveError = useSession((s) => s.markSaveError)
  const setConflict = useSession((s) => s.setConflict)
  const mutation = useSavePageEditMutation()

  const timerByPage = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  )
  const inFlight = useRef<Set<number>>(new Set())
  const pendingAfterFlight = useRef<Set<number>>(new Set())
  const lastSavedContent = useRef<Map<number, string>>(new Map())
  const savePageRef = useRef<(pageId: number) => Promise<void>>(async () => {})
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  const scheduleSave = (pageId: number) => {
    const existing = timerByPage.current.get(pageId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      timerByPage.current.delete(pageId)
      void savePageRef.current(pageId)
    }, DEBOUNCE_MS)
    timerByPage.current.set(pageId, timer)
  }

  savePageRef.current = async (pageId: number) => {
    if (inFlight.current.has(pageId)) {
      pendingAfterFlight.current.add(pageId)
      return
    }

    const current = useSession.getState().pages[pageId]
    if (!current?.dirty) return
    if (current.saveStatus === 'conflict') return

    const contentFp = contentFingerprint(current.edit)
    if (lastSavedContent.current.get(pageId) === contentFp) {
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
        user_id: userIdRef.current ?? undefined,
      })
      lastSavedContent.current.set(pageId, contentFingerprint(result.edit))
      markSaved(pageId, result.edit)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        skipFlush = true
        return
      }

      if (err instanceof ApiError && err.status === 409) {
        try {
          const latest = await api.getPageEdit(pageId)
          setConflict(pageId, latest.edit)
        } catch (resyncErr: unknown) {
          const msg =
            resyncErr instanceof ApiError && resyncErr.status === 503
              ? 'Kayıt servisi şu an kapalı — değişiklikleriniz yerelde duruyor'
              : resyncErr instanceof Error
                ? resyncErr.message
                : 'Kayıt çakışması çözülemedi — tekrar deneyin'
          markSaveError(pageId, msg)
        }
        skipFlush = true
        return
      }

      const msg =
        err instanceof ApiError
          ? err.status === 503
            ? 'Kayıt servisi şu an kapalı — değişiklikleriniz yerelde duruyor'
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
        if (again?.dirty && again.saveStatus !== 'conflict') scheduleSave(pageId)
        return
      }

      const again = useSession.getState().pages[pageId]
      if (
        again?.dirty &&
        again.saveStatus !== 'error' &&
        again.saveStatus !== 'conflict' &&
        lastSavedContent.current.get(pageId) !== contentFingerprint(again.edit)
      ) {
        scheduleSave(pageId)
      }
    }
  }

  useEffect(() => {
    if (!dirtyKey) return

    const pages = useSession.getState().pages
    for (const [idStr, page] of Object.entries(pages)) {
      if (!page.dirty) continue
      if (page.saveStatus === 'conflict') continue
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
      // Flush pages that were waiting on debounce so a quick Translator →
      // Letterer switch still persists before the timer would have fired.
      const pendingIds = [...timerByPage.current.keys()]
      for (const t of timerByPage.current.values()) clearTimeout(t)
      timerByPage.current.clear()
      for (const pageId of pendingIds) {
        savePageRef.current(pageId).catch((err) => {
          console.error(`[useAutosave] Unmount flush failed for page ${pageId}:`, err)
        })
      }
    }
  }, [])

  /** Immediate retry after an error (skips debounce). */
  const retrySave = (pageId: number) => {
    const existing = timerByPage.current.get(pageId)
    if (existing) {
      clearTimeout(existing)
      timerByPage.current.delete(pageId)
    }
    const cur = useSession.getState().pages[pageId]
    if (!cur) return
    if (cur.saveStatus === 'conflict') return
    if (!cur.dirty) {
      useSession.setState((s) => {
        const page = s.pages[pageId]
        if (!page) return s
        return {
          pages: {
            ...s.pages,
            [pageId]: { ...page, dirty: true, saveError: null },
          },
        }
      })
    }
    void savePageRef.current(pageId)
  }

  return { retrySave }
}
