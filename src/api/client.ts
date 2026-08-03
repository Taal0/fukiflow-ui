import type {
  BubbleLayout,
  Chapter,
  FontInfo,
  Layer,
  PageDetail,
  PageDoc,
  PageSummary,
} from './types'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { detail?: string; message?: string }
      detail = body.detail || body.message || detail
    } catch {
      /* ignore */
    }
    if (res.status === 503) {
      throw new ApiError(503, detail || 'Dizgi servisi şu an kapalı')
    }
    throw new ApiError(res.status, detail || `İstek başarısız (${res.status})`)
  }

  return (await res.json()) as T
}

async function requestBlob(path: string, init?: RequestInit): Promise<Blob> {
  const res = await fetch(path, init)
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { detail?: string; message?: string }
      detail = body.detail || body.message || detail
    } catch {
      /* ignore */
    }
    if (res.status === 503) {
      throw new ApiError(503, detail || 'Dizgi servisi şu an kapalı')
    }
    throw new ApiError(res.status, detail || `İstek başarısız (${res.status})`)
  }
  return res.blob()
}

export function fontFileUrl(font: FontInfo): string {
  if (font.url) return font.url
  return `/api/fonts/${encodeURIComponent(font.key)}/file`
}

export interface TypesetBody {
  texts: { bubble_id: number; text: string }[]
  font?: string | null
  overrides?: Record<
    string,
    { font_px?: number; font_scale?: number; font?: string }
  > | null
}

export interface TypesetResult {
  layouts: BubbleLayout[]
  text_layers: Layer[]
  typeset?: string
  typeset_regions?: number[][]
}

export interface ComposeBody {
  doc: PageDoc
  off?: string[]
  only_kind?: 'clean' | 'text' | null
  font?: string | null
}

export interface ChapterDownloadPage {
  page_id: number
  doc: PageDoc
  off?: string[]
  font?: string | null
}

export const api = {
  chapters: () => request<Chapter[]>('/api/chapters'),

  chapterPages: (slug: string) =>
    request<PageSummary[]>(`/api/chapters/${encodeURIComponent(slug)}/pages`),

  page: (pageId: number | string) =>
    request<PageDetail>(`/api/pages/${encodeURIComponent(String(pageId))}`),

  fonts: () => request<FontInfo[]>('/api/fonts'),

  typeset: (
    pageId: number,
    body: TypesetBody,
    init?: { signal?: AbortSignal },
  ) =>
    request<TypesetResult>(`/api/pages/${pageId}/typeset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: init?.signal,
    }),

  composeBlob: (
    pageId: number,
    body: ComposeBody,
    opts?: { download?: boolean; signal?: AbortSignal },
  ) =>
    requestBlob(
      `/api/pages/${pageId}/compose?download=${opts?.download ? 1 : 0}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: opts?.signal,
      },
    ),

  downloadChapter: (
    slug: string,
    pages: ChapterDownloadPage[],
    init?: { signal?: AbortSignal },
  ) =>
    requestBlob(`/api/chapters/${encodeURIComponent(slug)}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages }),
      signal: init?.signal,
    }),
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
