import { useEffect, useState } from 'react'
import { fontFileUrl } from '@/api/client'
import type { FontInfo } from '@/api/types'

const loaded = new Map<string, Promise<string>>()

export async function ensureFontLoaded(font: FontInfo): Promise<string> {
  const family = font.label || font.key
  const existing = loaded.get(font.key)
  if (existing) return existing

  const promise = (async () => {
    const url = fontFileUrl(font)
    const face = new FontFace(family, `url(${url})`, {
      style: 'normal',
      weight: '400',
    })
    const loadedFace = await face.load()
    document.fonts.add(loadedFace)
    await document.fonts.ready
    return family
  })()

  loaded.set(font.key, promise)
  try {
    return await promise
  } catch (err) {
    loaded.delete(font.key)
    throw err
  }
}

export function resolveFontFamily(
  fonts: FontInfo[] | undefined,
  hint: {
    key?: string | null
    family?: string | null
    postscript?: string | null
    file?: string | null
  },
): string {
  if (!fonts?.length) return hint.family || 'sans-serif'

  const byKey = hint.key
    ? fonts.find((f) => f.key === hint.key)
    : undefined
  if (byKey) return byKey.label || byKey.key

  if (hint.postscript) {
    const hit = fonts.find((f) => f.postscript_name === hint.postscript)
    if (hit) return hit.label || hit.key
  }

  if (hint.file) {
    const base = hint.file.split(/[/\\]/).pop()
    const hit = fonts.find((f) => f.file === base || f.file === hint.file)
    if (hit) return hit.label || hit.key
  }

  if (hint.family) {
    const lower = hint.family.toLowerCase()
    const hit = fonts.find(
      (f) =>
        f.label.toLowerCase() === lower ||
        f.key.toLowerCase() === lower.replace(/\s+/g, '_'),
    )
    if (hit) return hit.label || hit.key
    return hint.family
  }

  return fonts[0]?.label || 'sans-serif'
}

/** Preload catalog fonts used by the current page. */
export function usePageFonts(
  fonts: FontInfo[] | undefined,
  neededKeys: string[],
): { ready: boolean; error: string | null } {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = neededKeys.slice().sort().join('|')

  useEffect(() => {
    let cancelled = false
    if (!fonts?.length) {
      setReady(true)
      return
    }

    setReady(false)
    const targets = fonts.filter(
      (f) => neededKeys.length === 0 || neededKeys.includes(f.key),
    )
    const load = neededKeys.length === 0 ? fonts : targets

    Promise.all(load.map((f) => ensureFontLoaded(f).catch(() => null)))
      .then(() => {
        if (!cancelled) {
          setReady(true)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setReady(true)
          setError(e instanceof Error ? e.message : 'Font yüklenemedi')
        }
      })

    return () => {
      cancelled = true
    }
  }, [fonts, key, neededKeys.length])

  return { ready, error }
}
