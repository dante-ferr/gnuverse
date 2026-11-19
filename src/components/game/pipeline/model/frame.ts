import type { ElementCatalogJson } from '../../../../../game-server/pipeline/elements/index.ts'

export type Direction = 'north' | 'east' | 'south' | 'west'

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
  shape: 'circle'
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
  shape: 'circle'
  role?: SourceRole
  cooldown?: number
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
  deliveryByShape: Partial<Record<'circle', number>>
  demands: CoreDemandRecord[]
  collaborators: { id: string; nickname: string }[]
  belts: BeltRecord[]
  packets: { id: string; x: number; y: number; shape: 'circle' }[]
  originChunk?: ChunkCoordRecord
  ownedChunks?: ChunkCoordRecord[]
  previewChunks?: ChunkCoordRecord[]
  sources?: SourceRecord[]
  source: { id: string; x: number; y: number; direction: Direction; shape: 'circle' }
  core: { id: string; x: number; y: number }
}

export function isPipelineFrame(value: unknown): value is PipelineFrame {
  return Boolean(value && typeof value === 'object' && (value as { kind?: string }).kind === 'pipeline')
}

export function pipelineRulesFrom(rules: Record<string, unknown> | null): PipelineRules | null {
  const pipeline = rules?.pipeline
  if (!pipeline || typeof pipeline !== 'object') return null
  return pipeline as PipelineRules
}