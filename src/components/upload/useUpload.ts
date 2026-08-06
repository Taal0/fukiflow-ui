import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, api, errorDetail } from '@/api/client'

export type UploadPageStatus = 'pending' | 'processing' | 'done' | 'error'

export interface UploadPageState {
  pageNo: number
  status: UploadPageStatus
  stem?: string
  pageId?: number
  error?: string
  thumbUrl?: string
}

export interface UploadResult {
  slug: string
  title: string
  pages: number
  errors: Array<{ page_no?: number; stem?: string; error?: string }>
}

export interface UploadState {
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error'
  progress: { current: number; total: number }
  pages: UploadPageState[]
  activeLabel: string | null
  result?: UploadResult
  error?: string
}

const IDLE: UploadState = {
  status: 'idle',
  progress: { current: 0, total: 0 },
  pages: [],
  activeLabel: null,
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = 'message'
  let dataLines: string[] = []

  const flush = () => {
    if (!dataLines.length) {
      eventName = 'message'
      return
    }
    const raw = dataLines.join('\n')
    dataLines = []
    const name = eventName
    eventName = 'message'
    try {
      const data = JSON.parse(raw) as Record<string, unknown>
      onEvent(name, data)
    } catch {
      /* ignore malformed chunk */
    }
  }

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel()
        throw new DOMException('Aborted', 'AbortError')
      }
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split(/\r?\n/)
      buffer = parts.pop() ?? ''
      for (const line of parts) {
        if (line === '') {
          flush()
          continue
        }
        if (line.startsWith(':')) continue
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart())
        }
      }
    }
    if (buffer.trim()) {
      const line = buffer
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
      flush()
    }
  } finally {
    reader.releaseLock()
  }
}

export function useUpload() {
  const qc = useQueryClient()
  const [state, setState] = useState<UploadState>(IDLE)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState(IDLE)
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState((s) =>
      s.status === 'processing' || s.status === 'uploading'
        ? { ...s, status: 'error', error: 'Yükleme iptal edildi', activeLabel: null }
        : s,
    )
  }, [])

  const start = useCallback(
    async (files: File[], title?: string) => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      setState({
        status: 'uploading',
        progress: { current: 0, total: 0 },
        pages: [],
        activeLabel: 'Dosyalar gönderiliyor…',
      })

      try {
        const res = await api.uploadChapter(files, {
          title,
          signal: ac.signal,
        })

        if (!res.ok) {
          let detail = res.statusText
          try {
            detail = errorDetail(await res.json(), detail)
          } catch {
            /* ignore */
          }
          throw new ApiError(res.status, detail || `Yükleme başarısız (${res.status})`)
        }

        if (!res.body) {
          throw new ApiError(500, 'Boş yanıt')
        }

        setState((s) => ({
          ...s,
          status: 'processing',
          activeLabel: 'İşleniyor…',
        }))

        await readSseStream(
          res.body,
          (event, data) => {
            if (event === 'page_start') {
              const pageNo = Number(data.page_no)
              const total = Number(data.total) || 0
              setState((s) => {
                const pages = [...s.pages]
                const idx = pages.findIndex((p) => p.pageNo === pageNo)
                const next: UploadPageState = {
                  pageNo,
                  status: 'processing',
                  stem: typeof data.stem === 'string' ? data.stem : undefined,
                  pageId:
                    typeof data.page_id === 'number' ? data.page_id : undefined,
                }
                if (idx >= 0) pages[idx] = { ...pages[idx]!, ...next }
                else pages.push(next)
                pages.sort((a, b) => a.pageNo - b.pageNo)
                // Seed pending slots once we know total
                if (total > 0 && pages.length < total) {
                  for (let n = 1; n <= total; n++) {
                    if (!pages.some((p) => p.pageNo === n)) {
                      pages.push({ pageNo: n, status: 'pending' })
                    }
                  }
                  pages.sort((a, b) => a.pageNo - b.pageNo)
                }
                return {
                  ...s,
                  status: 'processing',
                  progress: {
                    current: pages.filter((p) => p.status === 'done' || p.status === 'error')
                      .length,
                    total: total || s.progress.total,
                  },
                  pages,
                  activeLabel: `Sayfa ${pageNo} — balon tespiti…`,
                }
              })
            } else if (event === 'page_done') {
              const pageNo = Number(data.page_no)
              const total = Number(data.total) || 0
              const slugHint =
                typeof data.slug === 'string' ? data.slug : undefined
              setState((s) => {
                const pages = s.pages.map((p) =>
                  p.pageNo === pageNo
                    ? {
                        ...p,
                        status: 'done' as const,
                        stem:
                          typeof data.stem === 'string' ? data.stem : p.stem,
                        pageId:
                          typeof data.page_id === 'number'
                            ? data.page_id
                            : p.pageId,
                        thumbUrl:
                          slugHint && typeof data.stem === 'string'
                            ? `/api/assets/${slugHint}/${data.stem}/${data.stem}.png`
                            : p.thumbUrl,
                      }
                    : p,
                )
                const done = pages.filter(
                  (p) => p.status === 'done' || p.status === 'error',
                ).length
                return {
                  ...s,
                  progress: { current: done, total: total || s.progress.total },
                  pages,
                  activeLabel: `Sayfa ${pageNo} tamamlandı`,
                }
              })
            } else if (event === 'page_error') {
              const pageNo = Number(data.page_no)
              const total = Number(data.total) || 0
              const err =
                typeof data.error === 'string' ? data.error : 'İşlem hatası'
              setState((s) => {
                const pages = s.pages.map((p) =>
                  p.pageNo === pageNo
                    ? { ...p, status: 'error' as const, error: err }
                    : p,
                )
                const done = pages.filter(
                  (p) => p.status === 'done' || p.status === 'error',
                ).length
                return {
                  ...s,
                  progress: { current: done, total: total || s.progress.total },
                  pages,
                  activeLabel: `Sayfa ${pageNo} — hata`,
                }
              })
            } else if (event === 'complete') {
              const result: UploadResult = {
                slug: String(data.slug ?? ''),
                title: String(data.title ?? ''),
                pages: Number(data.pages) || 0,
                errors: Array.isArray(data.errors)
                  ? (data.errors as UploadResult['errors'])
                  : [],
              }
              // Backfill thumb URLs now that we know the slug
              setState((s) => ({
                ...s,
                status: 'complete',
                activeLabel: null,
                result,
                pages: s.pages.map((p) =>
                  p.status === 'done' && p.stem && !p.thumbUrl
                    ? {
                        ...p,
                        thumbUrl: `/api/assets/${result.slug}/${p.stem}/${p.stem}.png`,
                      }
                    : p,
                ),
                progress: {
                  current: s.pages.filter(
                    (p) => p.status === 'done' || p.status === 'error',
                  ).length,
                  total: result.pages || s.progress.total,
                },
              }))
              void qc.invalidateQueries({ queryKey: ['chapters'] })
            }
          },
          ac.signal,
        )
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          setState((s) => ({
            ...s,
            status: 'error',
            error: 'Yükleme iptal edildi',
            activeLabel: null,
          }))
          return
        }
        const message =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Yükleme başarısız'
        setState((s) => ({
          ...s,
          status: 'error',
          error: message,
          activeLabel: null,
        }))
      } finally {
        if (abortRef.current === ac) abortRef.current = null
      }
    },
    [qc],
  )

  return { state, start, cancel, reset }
}
