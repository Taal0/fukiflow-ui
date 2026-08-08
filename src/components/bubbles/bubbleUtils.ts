import type { BubbleLayout, BubbleText } from '@/api/types'
import { textLayerId } from '@/api/types'

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
