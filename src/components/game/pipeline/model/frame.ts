import type { ElementCatalogJson } from '../../../../../game-server/pipeline/elements/index.ts'

export type Direction = 'north' | 'east' | 'south' | 'west'

export type PacketShape = string

export type PipelineRules = {
  tickMs: number
  gridWidth: number
  gridHeight: number
  sourcePeriodTicks: number
  colorBackground: string
  colorGrid: string
  gridVisibleMinZoom: number
  cameraZoomMin: number
  cameraZoomMax: number
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
  resourceGlyphOrbitPx: number
  resourceGlyphOrbitMs: number
  coreGearOuterMs: number
  coreGearInnerMs: number
  beltChevronStrokePx: number
  beltChevronFlowMs: number
  machineClearanceMin: number
  coreClearanceExtra: number
  coreDemandCircle: number
  chunkSize: number
  mapChunkExtent: number
  chunkCostBase: number
  chunkCostStep: number
  slotInputDepthPercent: number
  slotOutputDepthPercent: number
  slotBracketThickPercent: number
  slotFlowMarkDepthPercent: number
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

export type CoreRecord = { id: string; x: number; y: number }

export type CombinerRecord = {
  id: string
  machineId: 'combiner_2' | 'combiner_3'
  recipeId: string
  x: number
  y: number
  facing: Direction
  buffer?: Record<string, number>
  craftRemaining?: number | null
  pendingOutputs?: string[] | null
  nextSplitPort?: 0 | 1
}

export type BeltRecord = {
  id: string
  x: number
  y: number
  direction: Direction
  authorId: string
  authorNickname: string
  placedAt: number
}

export type PipelineFrame = {
  kind: 'pipeline'
  version: string
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
  sources?: SourceRecord[]
  source: { id: string; x: number; y: number; direction: Direction; shape: PacketShape }
  core: CoreRecord
  cores?: CoreRecord[]
  combiners?: CombinerRecord[]
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