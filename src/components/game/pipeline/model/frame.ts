import type { ElementCatalogJson } from '../../../../../game-server/pipeline/elements/index.ts'

export type Direction = 'north' | 'east' | 'south' | 'west'

export type PacketShape = string

export type PipelineRules = {
  tickMs: number
  gridWidth: number
  gridHeight: number
  colorBackground: string
  colorGrid: string
  gridVisibleMinZoom: number
  cameraZoomMin: number
  cameraZoomMax: number
  cameraEnterViewCells: number
  /** At/above: glyphs, chevrons, full machines. */
  lodDetailMinZoom: number
  /** At/above (below detail): flat machines + cores; below: cores only. */
  lodStructureMinZoom: number
  colorBelt: string
  colorBeltChevron: string
  colorPacket: string
  colorCore: string
  colorSource: string
  colorAccent: string
  colorDecor: string
  decorDarkenPercent: number
  outlineWidthPx: number
  colorOutline: string
  colorSurface: string
  colorMuted: string
  colorHighlight: string
  colorWarning: string
  colorSuccess: string
  colorInk: string
  decorStrokeWidth: number
  resourceGlyphSizePx: number
  /** Machine overlays: at/below, scale with the world; above, lock screen size at this zoom. */
  resourceGlyphWorldMinZoom: number
  resourceGlyphOrbitPx: number
  resourceGlyphOrbitMs: number
  resourceGlyphOutlineOuter: string
  resourceGlyphOutlineInner: string
  resourceGlyphOutlineOuterWidthPx: number
  resourceGlyphOutlineInnerWidthPx: number
  resourceGlyphOutlineSpread: number
  coreGearOuterMs: number
  coreGearInnerMs: number
  /** Keep gears spinning this long after last intake on that core (ms). */
  coreGearActiveMs: number
  beltChevronStrokePx: number
  beltChevronFlowMs: number
  beltSpeedFast: number
  colorFastBelt: string
  colorFastBeltChevron: string
  beltFastChevronFlowMs: number
  beltFastChevronArmPercent: number
  beltFastSideInsetPercent: number
  colorFastTunnel: string
  machineClearanceMin: number
  coreClearanceExtra: number
  chunkSize: number
  mapChunkExtent: number
  chunkCostBase: number
  chunkCostStep: number
  passiveCap: number
  walletCap: number
  coinsPerMinute: number
  beltCost: number
  fastBeltCost: number
  splitterCost: number
  combinerCost: number
  tunnelCost: number
  fastTunnelCost: number
  satelliteCoreCount: number
  satelliteCoreRingMin: number
  satelliteCoreRingMax: number
  slotInputDepthPercent: number
  slotOutputDepthPercent: number
  slotBracketThickPercent: number
  slotFlowMarkDepthPercent: number
  /** 1×1 splitter machine body. */
  colorSplitter: string
  /** Underground tunnel portal body. */
  colorTunnel: string
  /** Max empty cells between tunnel entrance and exit. */
  tunnelMaxGap: number
  /** Element catalog from `elements.toml` (same payload as the game-server). */
  elements: ElementCatalogJson
}

export type CoreDemandRecord = {
  shape: PacketShape
  received: number
  required: number
}

export type ChunkCoordRecord = { cx: number; cy: number }

/** Catalog element id this source emits / represents. */
export type SourceRole = string

export type SourceRecord = {
  id: string
  x: number
  y: number
  direction: Direction
  shape: PacketShape
  role?: SourceRole
  cooldown?: number
}

export type CoreRecord = {
  id: string
  x: number
  y: number
  lastIntakeTick?: number
}

export type CombinerRecord = {
  id: string
  machineId: 'combiner_2' | 'combiner_3'
  recipeId: string | null
  x: number
  y: number
  facing: Direction
  buffer?: Record<string, number>
  craftRemaining?: number | null
  pendingOutputs?: string[] | null
  nextSplitPort?: 0 | 1
  authorId: string
  authorNickname: string
}

export type SplitterRecord = {
  id: string
  x: number
  y: number
  facing: Direction
  authorId: string
  authorNickname: string
  nextSplitPort?: 0 | 1 | 2
  buffer?: PacketShape | null
}

export type TunnelPortalRecord = {
  id: string
  pairId: string
  role: 'entrance' | 'exit'
  x: number
  y: number
  direction: Direction
  speed?: number
  authorId: string
  authorNickname: string
  queue?: (PacketShape | null)[]
}

export type BeltRecord = {
  id: string
  x: number
  y: number
  direction: Direction
  speed?: number
  authorId: string
  authorNickname: string
  placedAt: number
}

export type ChunkPledgeRecord = {
  cx: number
  cy: number
  paid: number
  backers?: { userId: string; amount: number }[]
}

export type PipelineFrame = {
  kind: 'pipeline'
  version: string
  chapter?: number
  escalationWave?: number
  escalationWaveByShape?: Partial<Record<PacketShape, number>>
  waveDeliveryByShape?: Partial<Record<PacketShape, number>>
  seed: string
  width: number
  height: number
  tick: number
  deliveries: number
  deliveryByShape: Partial<Record<PacketShape, number>>
  demands: CoreDemandRecord[]
  collaborators: { id: string; nickname: string }[]
  belts: BeltRecord[]
  packets: { id: string; x: number; y: number; shape: PacketShape }[]
  sandbox?: boolean
  originChunk?: ChunkCoordRecord
  ownedChunks?: ChunkCoordRecord[]
  previewChunks?: ChunkCoordRecord[]
  chunkPledges?: ChunkPledgeRecord[]
  sources?: SourceRecord[]
  source: { id: string; x: number; y: number; direction: Direction; shape: PacketShape }
  core: CoreRecord
  cores?: CoreRecord[]
  combiners?: CombinerRecord[]
  splitters?: SplitterRecord[]
  tunnels?: TunnelPortalRecord[]
}

export function isPipelineFrame(value: unknown): value is PipelineFrame {
  return Boolean(value && typeof value === 'object' && (value as { kind?: string }).kind === 'pipeline')
}

export function pipelineRulesFrom(rules: Record<string, unknown> | null): PipelineRules | null {
  const pipeline = rules?.pipeline
  if (!pipeline || typeof pipeline !== 'object') return null
  return pipeline as PipelineRules
}

export function glyphUrlForShape(
  rules: PipelineRules | null,
  shape: PacketShape,
): string | null {
  if (shape === 'circle') return '/pipeline/resource-circle.svg'
  const el = rules?.elements.elements.find((item) => item.id === shape)
  if (!el?.glyph) return null
  return el.glyph.startsWith('/') ? el.glyph : `/${el.glyph}`
}