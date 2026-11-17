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
  /** GNUverse accent; site teal (legacy palette key). */
  colorAccent: string
  /** Palette ink reserved for future UI; machine overlays use darkenHex(body, decorDarkenPercent). */
  colorDecor: string
  /** Percent to darken each machine body color when tinting its decor SVG (0–90). */
  decorDarkenPercent: number
  /** Global stroke width (px) for bodies, slots, packets, glyphs. */
  outlineWidthPx: number
  /** Near-black outline color. */
  colorOutline: string
  /** Raised dark surface (site `--surface-raised`). */
  colorSurface: string
  /** Muted UI / secondary labels. */
  colorMuted: string
  /** Lighter teal hover / highlight. */
  colorHighlight: string
  /** Secondary coral accent (site `--secondary`). */
  colorWarning: string
  /** Soft success green sibling to accent teal. */
  colorSuccess: string
  /** Mid slate ink for future HUD copy on the scene. */
  colorInk: string
  /** SVG stroke width in artboard units (512 viewBox); keep in sync with public/pipeline/*.svg. */
  decorStrokeWidth: number
  /** Screen-space resource glyph diameter (px). */
  resourceGlyphSizePx: number
  /** Orbit radius around source center (screen px). */
  resourceGlyphOrbitPx: number
  /** Full orbit period (ms). */
  resourceGlyphOrbitMs: number
  /** Belt chevron stroke width (px, zoomed with the grid). */
  beltChevronStrokePx: number
  /** Ms for chevrons to drift one grid cell along the belt. */
  beltChevronFlowMs: number
  machineClearanceMin: number
  coreClearanceExtra: number
  /** v0.1 milestone: circle deliveries required before the next tier. */
  coreDemandCircle: number
}