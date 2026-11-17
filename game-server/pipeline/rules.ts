export type PipelineRules = {
  tickMs: number
  gridWidth: number
  gridHeight: number
  tileCap: number
  sourcePeriodTicks: number
  colorBackground: string
  colorGrid: string
  colorBelt: string
  colorPacket: string
  colorCore: string
  colorSource: string
  /** GNUverse accent; site teal (legacy palette key; decor ink uses colorBackground). */
  colorAccent: string
  /** SVG stroke width in artboard units (512 viewBox); keep in sync with public/pipeline/*.svg. */
  decorStrokeWidth: number
  /** Screen-space resource glyph diameter (px). */
  resourceGlyphSizePx: number
  /** Orbit radius around source center (screen px). */
  resourceGlyphOrbitPx: number
  /** Full orbit period (ms). */
  resourceGlyphOrbitMs: number
  machineClearanceMin: number
  coreClearanceExtra: number
}
