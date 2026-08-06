import { useEffect, useRef, useState } from 'react'
import type { BubbleLayout } from '@/api/types'

/** The text as it is *currently* broken into lines on the page. */
function layoutFormattedText(layout: BubbleLayout | undefined): string | null {
  if (!layout || layout.status !== 'ok' || !layout.lines?.length) return null
  return layout.lines.map((l) => l.text).join('\n')
}

/** Text box that mirrors on-page line breaks while idle. */
export function BubbleTextArea({
  text,
  layout,
  onFocus,
  onChange,
  autoFocus = false,
  placeholder = 'Balon metni…',
}: {
  text: string
  layout: BubbleLayout | undefined
  onFocus: () => void
  onChange: (text: string) => void
  autoFocus?: boolean
  placeholder?: string
}) {
  const external = layoutFormattedText(layout) ?? text
  const [local, setLocal] = useState(external)
  const [focused, setFocused] = useState(false)
  const syncedRef = useRef(external)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (focused || external === syncedRef.current) return
    syncedRef.current = external
    setLocal(external)
  }, [external, focused])

  useEffect(() => {
    if (!autoFocus) return
    const node = ref.current
    if (!node) return
    node.focus()
    // Place caret at end so a single click is ready to type.
    const len = node.value.length
    node.setSelectionRange(len, len)
  }, [autoFocus])

  return (
    <textarea
      ref={ref}
      value={local}
      rows={3}
      spellCheck={false}
      autoFocus={autoFocus}
      onFocus={() => {
        setFocused(true)
        onFocus()
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setLocal(e.target.value)
        onChange(e.target.value)
      }}
      className="w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1.5 text-[length:var(--text-ui)] leading-snug text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
      placeholder={placeholder}
    />
  )
}
