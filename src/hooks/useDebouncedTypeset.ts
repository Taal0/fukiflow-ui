import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/api/client'
import { useTypesetMutation } from '@/api/queries'
import type { PageDetail } from '@/api/types'
import { buildTypesetBody } from '@/lib/workingDoc'
import { useSession } from '@/store/session'

const DEBOUNCE_MS = 350

export function useDebouncedTypeset(detail: PageDetail | undefined) {
  const pageId = detail?.page.id
  const pageSession = useSession((s) =>
    pageId != null ? s.pages[pageId] : undefined,
  )
  const fontOverride = useSession((s) => s.fontOverride)
  const applyTypeset = useSession((s) => s.applyTypeset)
  const clearTypeset = useSession((s) => s.clearTypeset)
  const mutation = useTypesetMutation()

  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const textKey = JSON.stringify(pageSession?.textOverrides ?? {})
  const sizeKey = JSON.stringify(pageSession?.sizeOverrides ?? {})
  const bubbleFontKey = JSON.stringify(pageSession?.bubbleFontOverrides ?? {})
  const pageFontKey = fontOverride ?? ''

  const fingerprint =
    pageId != null
      ? `${pageId}|${textKey}|${sizeKey}|${bubbleFontKey}|${pageFontKey}`
      : ''
  const baseline = pageId != null ? `${pageId}|{}|{}|{}|` : ''
  const needsTypeset = Boolean(detail && pageId != null && fingerprint !== baseline)

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSentRef = useRef<string>('')

  useEffect(() => {
    if (!detail || pageId == null) return

    if (!needsTypeset) {
      if (timerRef.current) clearTimeout(timerRef.current)
      abortRef.current?.abort()
      const session = useSession.getState().pages[pageId]
      if (
        session &&
        (session.textLayers || Object.keys(session.layoutsByBubble).length > 0)
      ) {
        clearTypeset(pageId)
      }
      lastSentRef.current = ''
      setPending(false)
      setError(null)
      return
    }

    if (fingerprint === lastSentRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)
    setPending(true)

    timerRef.current = setTimeout(() => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      const body = buildTypesetBody(
        detail,
        useSession.getState().pages[pageId],
        useSession.getState().fontOverride,
      )

      mutation
        .mutateAsync({ pageId, body, signal: ac.signal })
        .then((result) => {
          if (ac.signal.aborted) return
          lastSentRef.current = fingerprint
          applyTypeset(pageId, result.layouts ?? [], result.text_layers ?? [])
          setError(null)
          setPending(false)
        })
        .catch((err: unknown) => {
          if (ac.signal.aborted) return
          if (err instanceof DOMException && err.name === 'AbortError') return
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

  return { pending, error, isError: Boolean(error) }
}
