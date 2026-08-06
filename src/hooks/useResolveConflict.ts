import { useQueryClient } from '@tanstack/react-query'
import { applyPageEditToCache } from '@/api/pageCache'
import { useSession } from '@/store/session'

/**
 * Conflict actions that keep the react-query page cache aligned with session.
 * (Store stays RQ-free; cache sync lives here.)
 */
export function useResolveConflict() {
  const qc = useQueryClient()
  const takeServer = useSession((s) => s.resolveConflictTakeServer)
  const keepMine = useSession((s) => s.resolveConflictKeepMine)

  return {
    takeServer: (pageId: number) => {
      const edit = takeServer(pageId)
      if (!edit) return
      applyPageEditToCache(qc, pageId, { edit, rev: edit.rev })
    },
    keepMine: (pageId: number) => {
      keepMine(pageId)
      // Stays dirty — autosave PUT patches the cache on success.
    },
  }
}
