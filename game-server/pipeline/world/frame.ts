import type { Direction } from '../geometry/direction.ts'
import type { PacketShape } from '../packets/packet.ts'
import type { CoreDemandRecord } from './progression/demands.ts'
import type { SourceRole } from './types.ts'

export type BeltRecord = {
  id: string
  x: number
  y: number
  direction: Direction
  authorId: string
  authorNickname: string
  placedAt: number
}

export type PacketRecord = {
  id: string
  x: number
  y: number
  shape: PacketShape
}

export type CollaboratorRecord = { id: string; nickname: string }

export type ChunkCoordRecord = { cx: number; cy: number }

export type SourceRecord = {
  id: string
  x: number
  y: number
  direction: Direction
  shape: PacketShape
  role: SourceRole
  cooldown: number
}

export type CoreRecord = {
  id: string
  x: number
  y: number
  /** Match tick index of the last packet this core consumed (omit / undefined = never). */
  lastIntakeTick?: number
}

export type CombinerRecord = {
  id: string
  machineId: 'combiner_2' | 'combiner_3'
  recipeId: string | null
  x: number
  y: number
  facing: Direction
  buffer: Record<string, number>
  craftRemaining: number | null
  pendingOutputs: string[] | null
  nextSplitPort: 0 | 1
}

export type SplitterRecord = {
  id: string
  x: number
  y: number
  facing: Direction
  authorId: string
  authorNickname: string
  nextSplitPort: 0 | 1 | 2
  buffer: PacketShape | null
}

export type TunnelPortalRecord = {
  id: string
  pairId: string
  role: 'entrance' | 'exit'
  x: number
  y: number
  direction: Direction
  authorId: string
  authorNickname: string
  /** Entrance only: underground lane occupancy (null = empty). */
  queue?: (PacketShape | null)[]
}

/** Persisted match. Classes are rebuilt from this on each tick. */
export type PipelineFrame = {
  kind: 'pipeline'
  version: string
  chapter?: number
  seed: string
  width: number
  height: number
  tick: number
  /** Sum of all shape deliveries (legacy aggregate; mirrors deliveryByShape). */
  deliveries: number
  deliveryByShape: Partial<Record<PacketShape, number>>
  demands: CoreDemandRecord[]
  collaborators: CollaboratorRecord[]
  nextPacketId: number
  nextBeltSeq: number
  nextCombinerSeq?: number
  nextSplitterSeq?: number
  nextTunnelSeq?: number
  sandbox?: boolean
  belts: BeltRecord[]
  packets: PacketRecord[]
  /** Destination cell key → last inbound cell key that won a merge into it. */
  mergeLast?: Record<string, string>
  /** Approach cell key → last winner between input pull and belt-forward flow. */
  pullLast?: Record<string, 'pull' | 'flow'>
  originChunk: ChunkCoordRecord
  ownedChunks: ChunkCoordRecord[]
  previewChunks: ChunkCoordRecord[]
  generatedChunkKeys?: string[]
  /** Reserved satellite core chunks (`"cx,cy"`); cores spawn when previewed. */
  satelliteChunkKeys?: string[]
  grassChunkKey?: string
  sources: SourceRecord[]
  /** First source mirror for legacy readers. */
  source: Omit<SourceRecord, 'role'> & { role?: SourceRole }
  core: CoreRecord
  cores?: CoreRecord[]
  combiners?: CombinerRecord[]
  splitters?: SplitterRecord[]
  tunnels?: TunnelPortalRecord[]
}

export function isPipelineFrame(value: unknown): value is PipelineFrame {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { kind?: string }).kind === 'pipeline',
  )
}