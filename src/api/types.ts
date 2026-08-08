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
  kind: 'clean' | 'text' | 'paint' | string
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
  strokes?: PaintStroke[]
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
  source_type?: 'seed' | 'upload' | string
  created_at?: string | null
  cover_url?: string | null
  done_count?: number
  bubble_count?: number
  processing_count?: number
  error_count?: number
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
  /** Overlay texts (bubbles + regions) with non-empty strip. */
  translated_count?: number
  processing_status?: string
  error_message?: string | null
  /** Soft-flag bubble count (editor_bubble_count) — total, not remaining. */
  flag_count?: number
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
  /** Clean fill MaskSpec.inset override (px). */
  inset?: number
}

export interface PaintStroke {
  id: string
  bubble_id?: number
  mode: 'fill' | 'restore'
  color?: [number, number, number]
  radius_px: number
  points: Point[]
}

/** Translator-drawn box purpose — only ``bubble`` goes through YOLO verify. */
export type RegionKind = 'bubble' | 'sfx' | 'other'

/** Manual translator box — not a seed bubble until YOLO-confirmed (bubble kind). */
export interface Region {
  id: string
  bbox: BBox
  text: string
  /** Defaults to ``bubble`` when missing (legacy edits). */
  kind: RegionKind
  status: 'unclassified' | 'verifying' | 'confirmed' | 'unconfirmed'
  confidence: number | null
  /** Set when status is confirmed — promoted seed bubble id. */
  bubble_id?: number
}

/** Letterer / translator overlay — seed PageDoc stays immutable. */
export interface PageEdit {
  rev: number
  page?: { font?: string }
  bubbles: Record<string, BubbleEdit>
  paint?: PaintStroke[]
  /** Translator-drawn boxes (SFX / missed text). */
  regions?: Region[]
  /** Unified reading order tokens: `b:<id>` | `r-*`. */
  order?: string[]
  /** Hard-deleted seed bubble ids — excluded from list/compose/progress. */
  removed_bubbles?: number[]
}

export type BrushMode = 'off' | 'fill' | 'restore'

export interface BrushState {
  mode: BrushMode
  radiusPx: number
  /** Last sampled RGB for fill strokes. */
  color: [number, number, number] | null
}

export interface PageProgress {
  page_id: number
  page_no: number
  bubble_count: number
  done_count: number
  translated_count?: number
}

export interface ChapterProgress {
  slug: string
  pages: PageProgress[]
}

export type SaveStatus = 'idle' | 'saved' | 'saving' | 'error' | 'conflict'


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
  /** Last writer identity (roller seam). */
  edit_author?: string | null
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

/** Stable layer id helpers — match vision/layers/build.py + edits paint merge */
export function cleanLayerId(bubbleId: number): string {
  return `cln_${bubbleId}`
}

export function textLayerId(bubbleId: number): string {
  return `txt_${bubbleId}`
}

export function paintLayerId(bubbleId: number): string {
  return `pnt_${bubbleId}`
}

export function bubbleGroupId(bubbleId: number): string {
  return `bubble_${bubbleId}`
}
