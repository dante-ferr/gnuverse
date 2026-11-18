export type PipelineRules = {
  tickMs: number
  gridWidth: number
  gridHeight: number
  sourcePeriodTicks: number
  colorBackground: string
  colorGrid: string
  colorBelt: string
  /** Flow arrows stroked on top of belt track fill. */
  colorBeltChevron: string
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
  /** Cells on one side of a purchasable map chunk (starter owned chunk uses the same size). */
  chunkSize: number
  /** Maximum chunks per axis in the world grid. */
  mapChunkExtent: number
  /** Base coin cost for the first purchased chunk (after the free starter). */
  chunkCostBase: number
  /** Linear increment per further purchase index (see chunkPurchaseCost). */
  chunkCostStep: number
  /**
   * Chance (0–100) to attempt placing a circle source when generating a non-starter chunk.
   * Reserved until probabilistic spawn is wired; starter layout ignores this.
   */
  sourceSpawnChanceCirclePercent: number
  /** Same for fire (starter fire+water always place; ignore these odds). */
  sourceSpawnChanceFirePercent: number
  sourceSpawnChanceWaterPercent: number
  /** Input “[” bracket protrusion as percent of one cell (shallower = recess). */
  slotInputDepthPercent: number
  /** Output bracket protrusion as percent of one cell (deeper = nozzle). */
  slotOutputDepthPercent: number
  /** Shared bracket spine thickness as percent of one cell. */
  slotBracketThickPercent: number
  /** Chevron tip depth along travel, baked into the bracket spine (percent of one cell). */
  slotFlowMarkDepthPercent: number
}