/** Mirrors vision.document / vision.types (OpenAPI-compatible shapes). */

export type Point = [number, number] | number[]
export type BBox = [number, number, number, number]

export interface Panel {
  id: number
  bbox: BBox
  confidence?: number
  reading_order?: number
  is_synthetic?: boolean
}

export interface Bubble {
  id: number
  polygon: Point[]
  bbox: BBox
  confidence?: number
  cls?: number
  panel_id?: number | null
  assign_mode?: string
  reading_order?: number | null
  order_source?: string
  order_confidence?: number
  clean_status?: string
}

export interface TypesetLine {
  text: string
  x: number
  baseline_y: number
  width: number
}

export interface BubbleLayout {
  bubble_id: number
  status?: string
  reason?: string | null
  font_family?: string | null
  font_px?: number | null
  font_pt?: number | null
  font_ratio?: number | null
  leading_px?: number | null
  leading_pt?: number | null
  font_postscript_name?: string | null
  font_file?: string | null
  align?: string
  lines?: TypesetLine[]
  hyphenated?: boolean
  frame?: BBox | null
  overflow?: boolean
  override_source?: string | null
}

export interface BubbleText {
  bubble_id: number
  text?: string
}

export interface SourceRef {
  file?: string
  width: number
  height: number
  dpi?: number
  color_mode?: string
}

export interface MaskSpec {
  type?: string
  polygon?: Point[]
  inset?: number
  size?: [number, number] | null
  bbox?: BBox | null
  counts?: string | null
  file?: string | null
}

export interface Layer {
  id: string
  kind: 'clean' | 'text' | string
  name: string
  group?: string | null
  bubble_id?: number | null
  enabled?: boolean
  opacity?: number
  blend?: string
  z?: number
  source_step?: string
  bbox: BBox
  mask?: MaskSpec | null
  fill_color?: [number, number, number] | null
  raster_file?: string | null
  layout?: BubbleLayout | null
  frame?: BBox | null
}

export interface DocFlags {
  clean?: string
  typeset?: string
  editor_bubble_ids?: number[]
  typeset_editor_bubble_ids?: number[]
}

export interface PageDoc {
  schema_version?: number
  page_id: string
  source: SourceRef
  bubbles: Bubble[]
  texts: BubbleText[]
  layers: Layer[]
  flags?: DocFlags
}

export interface Chapter {
  id: number
  slug: string
  title: string
  page_count: number
}

export interface PageSummary {
  id: number
  page_no: number
  stem: string
  width: number
  height: number
  thumb_url: string | null
  clean_status: string
  typeset_status: string
  bubble_count: number
  /** Bubbles marked done in the PageEdit overlay. */
  done_count?: number
}

/** Per-bubble overlay fields persisted in PageEdit. */
export interface BubbleEdit {
  text?: string
  font?: string
  /** Legacy % scale; Phase 1 prefers font_px. */
  font_scale?: number
  font_px?: number
  leading?: number
  align?: 'left' | 'center' | 'right' | string
  frame?: BBox
  layers_off?: string[]
  done?: boolean
}

export interface PaintStroke {
  id: string
  bubble_id?: number
  mode: 'fill' | 'restore'
  color?: [number, number, number]
  radius_px: number
  points: Point[]
}

/** Letterer overlay — seed PageDoc stays immutable. */
export interface PageEdit {
  rev: number
  page?: { font?: string }
  bubbles: Record<string, BubbleEdit>
  paint?: PaintStroke[]
}

export interface PageProgress {
  page_id: number
  page_no: number
  bubble_count: number
  done_count: number
}

export interface ChapterProgress {
  slug: string
  pages: PageProgress[]
}

export type SaveStatus = 'idle' | 'saved' | 'saving' | 'error'

export interface LayerAsset {
  layer_id: string
  url: string
  offset_x: number
  offset_y: number
  width: number
  height: number
  kind?: string
  bubble_id?: number | null
}

export interface PageAssets {
  original_url: string
  cleaned_url?: string | null
  compose_url?: string | null
}

export interface PageDetail {
  page: PageSummary
  doc: PageDoc
  assets: PageAssets
  layer_assets: LayerAsset[]
  /** PageEdit overlay; empty shape when none saved yet. */
  edit?: PageEdit | null
  edit_rev?: number
}

export interface FontInfo {
  key: string
  label: string
  file: string
  postscript_name: string
  /** Absolute or app-relative URL for FontFace loading. */
  url?: string
}

export type ViewMode = 'composed' | 'original' | 'split'

/** Stable layer id helpers — match vision/layers/build.py */
export function cleanLayerId(bubbleId: number): string {
  return `cln_${bubbleId}`
}

export function textLayerId(bubbleId: number): string {
  return `txt_${bubbleId}`
}

export function bubbleGroupId(bubbleId: number): string {
  return `bubble_${bubbleId}`
}
