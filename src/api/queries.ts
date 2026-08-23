import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api, ApiError, type TypesetBody, type TypesetResult } from './client'
import {
  applyPageEditToCache,
  clearPageEditInCache,
  invalidateChapterOverlayLists,
  pageQueryKey,
} from './pageCache'
import type { PageDetail, PageEdit } from './types'

/** Truly immutable catalogs (fonts, seed asset URLs don't change mid-session). */
const IMMUTABLE_STALE = 1000 * 60 * 60

/**
 * PageDetail mixes immutable seed doc with a mutable PageEdit overlay.
 * Keep a short stale window and always revalidate on mount/focus so role
 * switches (Translator ↔ Letterer) and tab returns see the latest overlay.
 * Mutations still patch the cache immediately so we don't wait on the network.
 */
const PAGE_STALE = 10_000

export function useChapters() {
  return useQuery({
    queryKey: ['chapters'],
    queryFn: api.chapters,
    staleTime: 30_000,
  })
}

export function useChapterPages(slug: string | undefined) {
  return useQuery({
    queryKey: ['chapters', slug, 'pages'],
    queryFn: () => api.chapterPages(slug!),
    enabled: Boolean(slug),
    staleTime: 30_000,
  })
}

export function useChapterProgress(slug: string | undefined) {
  return useQuery({
    queryKey: ['chapters', slug, 'progress'],
    queryFn: () => api.chapterProgress(slug!),
    enabled: Boolean(slug),
    staleTime: 5_000,
  })
}

/**
 * Only return detail that belongs to ``pageId``.
 *
 * Never keep-previous across page keys: identical re-uploads share bubble ids,
 * so merging page A's seed with page B's overlay makes translations look like
 * they jumped between mangas.
 */
export function usePage(pageId: number | null | undefined) {
  const query = useQuery({
    queryKey: pageId != null ? pageQueryKey(pageId) : ['pages', 'none'],
    queryFn: () => api.page(pageId!),
    enabled: pageId != null,
    staleTime: PAGE_STALE,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false
      }
      return failureCount < 3
    },
  })

  const data: PageDetail | undefined =
    pageId != null && query.data?.page.id === pageId ? query.data : undefined

  return { ...query, data }
}

/** Warm prev/next page queries so gallery flips stay on the held page briefly or skip the wait. */
export function usePrefetchNeighborPages(
  selectedPageId: number | null | undefined,
  pageIds: readonly number[],
) {
  const qc = useQueryClient()
  useEffect(() => {
    if (selectedPageId == null || pageIds.length < 2) return
    const idx = pageIds.indexOf(selectedPageId)
    if (idx < 0) return
    for (const id of [pageIds[idx - 1], pageIds[idx + 1]]) {
      if (id == null) continue
      void qc.prefetchQuery({
        queryKey: pageQueryKey(id),
        queryFn: () => api.page(id),
        staleTime: PAGE_STALE,
        retry: (failureCount, error) => {
          if (
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) {
            return false
          }
          return failureCount < 3
        },
      })
    }
  }, [qc, selectedPageId, pageIds])
}

export function useFonts() {
  return useQuery({
    queryKey: ['fonts'],
    queryFn: api.fonts,
    staleTime: IMMUTABLE_STALE,
    retry: 1,
  })
}

export function useTypesetMutation() {
  return useMutation({
    mutationFn: ({
      pageId,
      body,
      signal,
    }: {
      pageId: number
      body: TypesetBody
      signal?: AbortSignal
    }): Promise<TypesetResult> => api.typeset(pageId, body, { signal }),
  })
}

export function useSavePageEditMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      pageId,
      rev,
      edit,
      user_id,
    }: {
      pageId: number
      rev: number
      edit: PageEdit
      user_id?: string | null
      signal?: AbortSignal
    }) => api.putPageEdit(pageId, { rev, edit, user_id }),
    onSuccess: async (result, { pageId }) => {
      // Drop in-flight GETs so a late refetch can't stomp this write.
      await qc.cancelQueries({ queryKey: pageQueryKey(pageId) })
      applyPageEditToCache(qc, pageId, {
        edit: result.edit,
        rev: result.rev,
        author: result.author,
      })
      invalidateChapterOverlayLists(qc)
    },
  })
}

export function useDeletePageEditMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pageId: number) => api.deletePageEdit(pageId),
    onSuccess: async (_data, pageId) => {
      await qc.cancelQueries({ queryKey: pageQueryKey(pageId) })
      clearPageEditInCache(qc, pageId)
      invalidateChapterOverlayLists(qc)
      void qc.invalidateQueries({ queryKey: pageQueryKey(pageId) })
    },
  })
}

export function useDeleteChapterMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => api.deleteChapter(slug),
    onSuccess: (_data, slug) => {
      void qc.invalidateQueries({ queryKey: ['chapters'] })
      void qc.removeQueries({ queryKey: ['chapters', slug] })
    },
  })
}

export function useDeletePageMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pageId: number) => api.deletePage(pageId),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['chapters'] })
      void qc.invalidateQueries({ queryKey: ['chapters', data.slug] })
      void qc.removeQueries({ queryKey: pageQueryKey(data.page_id) })
      if (data.chapter_deleted) {
        void qc.removeQueries({ queryKey: ['chapters', data.slug] })
      }
    },
  })
}

export function useReprocessPageMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pageId: number) => api.reprocessPage(pageId),
    onSuccess: (_data, pageId) => {
      // 'chapters' prefix'i chapters listesi + tüm pages/progress sorgularını kapsar.
      void qc.invalidateQueries({ queryKey: ['chapters'] })
      void qc.invalidateQueries({ queryKey: pageQueryKey(pageId) })
    },
  })
}
