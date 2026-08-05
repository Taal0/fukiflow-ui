import { useCallback, useEffect, useRef, useState } from 'react'

interface Options {
  /** Controlled width in px. */
  value: number
  onChange: (width: number) => void
  min: number
  max: number
  defaultValue: number
  /** Drag from the left edge (grows leftward) vs right edge. */
  edge?: 'left' | 'right'
}

/** Pointer-driven panel width with double-click reset. */
export function useResizablePanel({
  value,
  onChange,
  min,
  max,
  defaultValue,
  edge = 'right',
}: Options) {
  const [dragging, setDragging] = useState(false)
  const startRef = useRef<{ x: number; width: number } | null>(null)

  const clamp = useCallback(
    (w: number) => Math.min(max, Math.max(min, Math.round(w))),
    [min, max],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      startRef.current = { x: e.clientX, width: value }
      setDragging(true)
    },
    [value],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current) return
      const dx = e.clientX - startRef.current.x
      const next =
        edge === 'right'
          ? startRef.current.width + dx
          : startRef.current.width - dx
      onChange(clamp(next))
    },
    [clamp, edge, onChange],
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    startRef.current = null
    setDragging(false)
    try {
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const onDoubleClick = useCallback(() => {
    onChange(defaultValue)
  }, [defaultValue, onChange])

  useEffect(() => {
    if (!dragging) return
    const prev = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = prev
      document.body.style.userSelect = prevSelect
    }
  }, [dragging])

  return {
    width: clamp(value),
    dragging,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onDoubleClick,
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
      'aria-valuenow': clamp(value),
      'aria-valuemin': min,
      'aria-valuemax': max,
      tabIndex: 0,
      onKeyDown: (e: React.KeyboardEvent) => {
        const step = e.shiftKey ? 24 : 8
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          onChange(clamp(value + (edge === 'right' ? -step : step)))
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          onChange(clamp(value + (edge === 'right' ? step : -step)))
        } else if (e.key === 'Home') {
          e.preventDefault()
          onChange(min)
        } else if (e.key === 'End') {
          e.preventDefault()
          onChange(max)
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onChange(defaultValue)
        }
      },
    },
  }
}
