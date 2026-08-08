import type {
  Bubble,
  BubbleLayout,
  Chapter,
  ChapterProgress,
  FontInfo,
  Layer,
  LayerAsset,
  PageDetail,
  PageDoc,
  PageEdit,
  PageSummary,
  Region,
} from './types'

/** Optional absolute API origin for desktop / remote packaging.
 * Empty (default) → same-origin `/api/...` (Vite proxy in dev).
 * Example: `VITE_API_BASE=http://127.0.0.1:8000`
 */
const API_BASE = String(import.meta.env.VITE_API_BASE ?? '')
  .trim()
  .replace(/\/$/, '')

export function apiUrl(path: string): string {
  if (!path.startsWith('/')) path = `/${path}`
  return API_BASE ? `${API_BASE}${path}` : path
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function errorDetail(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const b = body as {
    detail?: string | { message?: string }
    message?: string
  }
  if (typeof b.detail === 'string') return b.detail
  if (b.detail && typeof b.detail === 'object' && b.detail.message) {
    return b.detail.message
  }
  if (typeof b.message === 'string') return b.message
  return fallback
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = errorDetail(await res.json(), detail)
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
  const res = await fetch(apiUrl(path), init)
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
  if (font.url) {
    // Absolute or already-rooted asset URLs pass through; relative API paths
    // get the configured base for desktop packaging.
    if (/^https?:\/\//i.test(font.url) || font.url.startsWith('data:')) {
      return font.url
    }
    return apiUrl(font.url.startsWith('/') ? font.url : `/${font.url}`)
  }
  return apiUrl(`/api/fonts/${encodeURIComponent(font.key)}/file`)
}

export interface TypesetBody {
  texts: { bubble_id: number; text: string }[]
  font?: string | null
  overrides?: Record<
    string,
    {
      font_px?: number
      font_scale?: number
      font?: string
      frame?: [number, number, number, number] | number[]
      leading?: number
      align?: string
    }
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

  getPageEdit: (pageId: number) =>
    request<{ rev: number; edit: PageEdit; author?: string | null }>(
      `/api/pages/${pageId}/edit`,
    ),

  putPageEdit: (
    pageId: number,
    body: { rev: number; edit: PageEdit; user_id?: string | null },
    init?: { signal?: AbortSignal },
  ) =>
    request<{ rev: number; edit: PageEdit; author?: string | null }>(
      `/api/pages/${pageId}/edit`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: init?.signal,
      },
    ),

  deletePageEdit: (pageId: number) =>
    request<{ ok: boolean; deleted: boolean }>(`/api/pages/${pageId}/edit`, {
      method: 'DELETE',
    }),

  chapterProgress: (slug: string) =>
    request<ChapterProgress>(
      `/api/chapters/${encodeURIComponent(slug)}/progress`,
    ),

  /** POST multipart upload; response body is an SSE stream. */
  uploadChapter: (
    files: File[],
    opts?: { title?: string; signal?: AbortSignal },
  ) => {
    const form = new FormData()
    if (opts?.title?.trim()) form.append('title', opts.title.trim())
    const isZip =
      files.length === 1 &&
      (files[0]!.name.toLowerCase().endsWith('.zip') ||
        files[0]!.type === 'application/zip' ||
        files[0]!.type === 'application/x-zip-compressed')
    if (isZip) {
      form.append('zip_file', files[0]!)
    } else {
      for (const f of files) form.append('files', f)
    }
    return fetch(apiUrl('/api/chapters/upload'), {
      method: 'POST',
      body: form,
      headers: { Accept: 'text/event-stream' },
      signal: opts?.signal,
    })
  },

  deleteChapter: (slug: string) =>
    request<{ ok: boolean; slug: string }>(
      `/api/chapters/${encodeURIComponent(slug)}`,
      { method: 'DELETE' },
    ),

  deletePage: (pageId: number) =>
    request<{
      ok: boolean
      page_id: number
      chapter_deleted: boolean
      slug: string
    }>(`/api/pages/${pageId}`, { method: 'DELETE' }),

  verifyRegions: (
    pageId: number,
    init?: { signal?: AbortSignal },
  ) =>
    request<VerifyRegionsResult>(`/api/pages/${pageId}/verify-regions`, {
      method: 'POST',
      signal: init?.signal,
    }),
}

export interface VerifyRegionsResult {
  rev: number
  regions: Region[]
  promoted: Bubble[]
  additional_bubbles: Bubble[]
  layer_assets: LayerAsset[]
  edit: PageEdit
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
