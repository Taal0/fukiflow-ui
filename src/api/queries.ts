import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type TypesetBody, type TypesetResult } from './client'
import type { PageEdit } from './types'

/** Seed data is immutable for the demo — keep it warm. */
const SEED_STALE = 1000 * 60 * 60

export function useChapters() {
  return useQuery({
    queryKey: ['chapters'],
    queryFn: api.chapters,
    staleTime: SEED_STALE,
  })
}

export function useChapterPages(slug: string | undefined) {
  return useQuery({
    queryKey: ['chapters', slug, 'pages'],
    queryFn: () => api.chapterPages(slug!),
    enabled: Boolean(slug),
    staleTime: SEED_STALE,
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

export function usePage(pageId: number | null | undefined) {
  return useQuery({
    queryKey: ['pages', pageId],
    queryFn: () => api.page(pageId!),
    enabled: pageId != null,
    staleTime: SEED_STALE,
    // Keep the previous page on screen while the next one fetches — otherwise
    // PageCanvas unmounts and the fit-to-view race blanks the viewport.
    placeholderData: (previous) => previous,
  })
}

export function useFonts() {
  return useQuery({
    queryKey: ['fonts'],
    queryFn: api.fonts,
    staleTime: SEED_STALE,
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
    }: {
      pageId: number
      rev: number
      edit: PageEdit
      signal?: AbortSignal
    }) => api.putPageEdit(pageId, { rev, edit }),
    onSuccess: () => {
      // Refresh gallery progress only — don't refetch the open page doc
      // (client already has the overlay; a mid-edit refetch races hydrate).
      void qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'chapters' &&
          (q.queryKey[2] === 'progress' || q.queryKey[2] === 'pages'),
      })
    },
  })
}

export function useDeletePageEditMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pageId: number) => api.deletePageEdit(pageId),
    onSuccess: (_data, pageId) => {
      void qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'chapters' &&
          (q.queryKey[2] === 'progress' || q.queryKey[2] === 'pages'),
      })
      void qc.invalidateQueries({ queryKey: ['pages', pageId] })
    },
  })
}
