import type { Direction } from '../geometry/direction.ts'
import type { PacketShape } from '../packets/packet.ts'
import type { CoreDemandRecord } from './demands.ts'

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

/** Persisted match. Classes are rebuilt from this on each tick. */
export type PipelineFrame = {
  kind: 'pipeline'
  version: '0.1'
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
  source: {
    id: string
    x: number
    y: number
    direction: Direction
    shape: PacketShape
    cooldown: number
  }
  core: { id: string; x: number; y: number }
}

export function isPipelineFrame(value: unknown): value is PipelineFrame {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { kind?: string }).kind === 'pipeline',
  )
}