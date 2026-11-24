import type { ElementCatalogJson } from './elements/index.ts'

export type PipelineRules = {
  tickMs: number
  gridWidth: number
  gridHeight: number
  colorBackground: string
  colorGrid: string
  /** Show per-cell grid strokes when camera zoom is at or above this factor (zoomed in). */
  gridVisibleMinZoom: number
  /** Smallest camera zoom factor (zoomed out; see more of the map). */
  cameraZoomMin: number
  /** Largest camera zoom factor (zoomed in). */
  cameraZoomMax: number
  /** On first room visit, fit this many cells along the shorter viewport edge. */
  cameraEnterViewCells: number
  /** Lobby room thumbnails: shorter edge spans this many cells around the starting core. */
  lobbyThumbnailViewCells: number
  /** At/above this zoom: packet glyphs, belt chevrons, full machine art. */
  lodDetailMinZoom: number
  /** At/above this (and below detail): flat machine fills + cores; below: cores only. */
  lodStructureMinZoom: number
  colorBelt: string
  /** Flow arrows stroked on top of belt track fill. */
  colorBeltChevron: string
  colorPacket: string
  colorCore: string
  colorSource: string
  /** 1×1 splitter machine body. */
  colorSplitter: string
  /** 2×2 trashcan machine body. */
  colorTrashcan: string
  /** Underground tunnel portal body. */
  colorTunnel: string
  /** Max empty cells between tunnel entrance and exit. */
  tunnelMaxGap: number
  /** Underground occupancy bead radius (% of one cell). */
  tunnelGhostRadiusPercent: number
  /** Occupancy bead / portal pip opacity. */
  tunnelGhostAlpha: number
  /** Dashed underground thread weight (% of one cell; painter scales it). */
  tunnelSeamWidthPercent: number
  /** Dashed underground thread opacity. */
  tunnelSeamAlpha: number
  /** Reserved presentation period (ms); pass-through flights use tickMs. */
  tunnelPulseMs: number
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
  /** Resource glyph diameter (px). Fallback when an element omits glyph_size_px. */
  resourceGlyphSizePx: number
  /**
   * Above: machine glyphs stay screen-fixed at `resourceGlyphSizePx` (zoom in → glyph
   * looks small on the machine). At/below: shrink with the world, continuous at this zoom.
   */
  resourceGlyphWorldMinZoom: number
  /** Orbit radius around source center (same space as the glyph diameter). */
  resourceGlyphOrbitPx: number
  /** Full orbit period (ms). */
  resourceGlyphOrbitMs: number
  /**
   * Glyph outline presentation: `dual` (outer+inner solid), `single` (one solid ring),
   * or `blur` (soft halo using `resourceGlyphOutlineBlur`).
   */
  resourceGlyphOutlineMode: 'dual' | 'single' | 'blur'
  /** Outer (usually white) outline color for element glyphs and belt packets. */
  resourceGlyphOutlineOuter: string
  /** Inner (usually black) outline color for element glyphs and belt packets. */
  resourceGlyphOutlineInner: string
  /** Soft halo color when outline mode is `blur`. */
  resourceGlyphOutlineBlur: string
  /** Outer outline thickness (screen px). 0 disables the outer ring. */
  resourceGlyphOutlineOuterWidthPx: number
  /** Inner outline thickness (screen px). 0 disables the inner ring. */
  resourceGlyphOutlineInnerWidthPx: number
  /** Multiplier for silhouette offset rings (larger = thicker halo). */
  resourceGlyphOutlineSpread: number
  /** Combiner craft progress wheel stroke width (screen px). */
  craftProgressWheelWidthPx: number
  /** Hide the craft progress wheel below this camera zoom (glyph still draws). */
  craftProgressWheelMinZoom: number
  /** Core outer gear full clockwise turn (ms). */
  coreGearOuterMs: number
  /** Core inner gear full counter-clockwise turn (ms). */
  coreGearInnerMs: number
  /** Keep core gears spinning this long after the last intake on that core (ms). */
  coreGearActiveMs: number
  /** Belt chevron stroke width (px, zoomed with the grid). */
  beltChevronStrokePx: number
  /** Ms for chevrons to drift one grid cell along the belt. */
  beltChevronFlowMs: number
  /** Belt/tunnel cells (or queue steps) advanced per match tick for fast variants. */
  beltSpeedFast: number
  /** Fast belt track fill (gray; typically matches colorBelt). */
  colorFastBelt: string
  /** Red chevrons and side rails on fast belts. */
  colorFastBeltChevron: string
  /** Chevron drift period for fast belts (ms). */
  beltFastChevronFlowMs: number
  /** Fast belt chevron arm length (% of one cell). */
  beltFastChevronArmPercent: number
  /** Side-rail inset from the belt outer edge (% of one cell). */
  beltFastSideInsetPercent: number
  /** Fast tunnel portal body (gray; red details reuse colorFastBeltChevron). */
  colorFastTunnel: string
  machineClearanceMin: number
  coreClearanceExtra: number
  /** Cells on one side of a purchasable map chunk (starter owned chunk uses the same size). */
  chunkSize: number
  /** Maximum chunks per axis in the world grid. */
  mapChunkExtent: number
  /** Base coin cost for the first purchased chunk (after the free starter). */
  chunkCostBase: number
  /** Linear increment per further purchase index (see chunkPurchaseCost). */
  chunkCostStep: number
  /** Passive income stops at this balance. Refunds may sit above it. */
  passiveCap: number
  /** Absolute wallet maximum. */
  walletCap: number
  /** Passive coins granted per minute, including while the player is away. */
  coinsPerMinute: number
  /** Coin cost of one normal belt cell. */
  beltCost: number
  /** Coin cost of one fast belt cell. */
  fastBeltCost: number
  /** Coin cost of one splitter. */
  splitterCost: number
  /** Coin cost of one trashcan. */
  trashcanCost: number
  /** Coin cost of one combiner. */
  combinerCost: number
  /** Coin cost of one tunnel pair. */
  tunnelCost: number
  /** Coin cost of one fast tunnel pair. */
  fastTunnelCost: number
  /**
   * Percent of list price (or fast−normal delta) refunded on own delete /
   * owned fast→normal downgrade. Rounded down.
   */
  refundPercent: number
  /** Satellite cores besides the central one (normal rooms). */
  satelliteCoreCount: number
  /** Inclusive Chebyshev min ring from starter chunk. */
  satelliteCoreRingMin: number
  /** Inclusive Chebyshev max ring from starter chunk. */
  satelliteCoreRingMax: number
  /** Roll on first generate beyond ring 4 (non-satellite chunks). */
  optionalCoreSpawnChancePercent: number
  /** Pooled buy price for an optional core (no progression). */
  optionalCoreCost: number
  /** Input “[” bracket protrusion as percent of one cell (shallower = recess). */
  slotInputDepthPercent: number
  /** Output bracket protrusion as percent of one cell (deeper = nozzle). */
  slotOutputDepthPercent: number
  /** Shared bracket spine thickness as percent of one cell. */
  slotBracketThickPercent: number
  /** Chevron tip depth along travel, baked into the bracket spine (percent of one cell). */
  slotFlowMarkDepthPercent: number
  /**
   * Full element catalog from `elements.toml` (recipes, chapters, presentation, starters).
   * Content and progression must come from this object — do not hardcode element ids in TS.
   */
  elements: ElementCatalogJson
}