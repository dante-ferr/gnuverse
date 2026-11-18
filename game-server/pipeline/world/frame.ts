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

/** Persisted match. Classes are rebuilt from this on each tick. */
export type PipelineFrame = {
  kind: 'pipeline'
  version: string
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
  belts: BeltRecord[]
  packets: PacketRecord[]
  /** Destination cell key → last inbound cell key that won a merge into it. */
  mergeLast?: Record<string, string>
  originChunk: ChunkCoordRecord
  ownedChunks: ChunkCoordRecord[]
  previewChunks: ChunkCoordRecord[]
  sources: SourceRecord[]
  /** First source mirror for legacy readers. */
  source: Omit<SourceRecord, 'role'> & { role?: SourceRole }
  core: { id: string; x: number; y: number }
}

export function isPipelineFrame(value: unknown): value is PipelineFrame {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { kind?: string }).kind === 'pipeline',
  )
}