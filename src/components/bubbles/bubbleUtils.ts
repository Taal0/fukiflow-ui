import type { Bubble, BubbleLayout, BubbleText } from '@/api/types'
import { textLayerId } from '@/api/types'
import { reasonLabel } from '@/components/flags'

export function seedText(bubbleId: number, texts: BubbleText[]): string {
  return texts.find((t) => t.bubble_id === bubbleId)?.text ?? ''
}

export function displayText(
  bubbleId: number,
  texts: BubbleText[],
  overrides: Record<number, string>,
): string {
  if (overrides[bubbleId] !== undefined) return overrides[bubbleId]!
  return seedText(bubbleId, texts)
}

export function bubbleBadges(
  bubble: Bubble,
  layout: BubbleLayout | undefined,
): string[] {
  const out: string[] = []
  if (bubble.clean_status === 'editor') {
    const t = reasonLabel('clean_editor')
    if (t) out.push(t)
  }
  if (layout?.status === 'editor' || layout?.reason) {
    const t = reasonLabel(layout.reason ?? 'editor')
    if (t && !out.includes(t)) out.push(t)
  }
  if (layout?.overflow) out.push('Taşma')
  return out
}

export function layoutForBubble(
  bubbleId: number,
  layoutsByBubble: Record<number, BubbleLayout>,
  layers: { id: string; layout?: BubbleLayout | null }[],
): BubbleLayout | undefined {
  return (
    layoutsByBubble[bubbleId] ??
    layers.find((l) => l.id === textLayerId(bubbleId))?.layout ??
    undefined
  )
}
