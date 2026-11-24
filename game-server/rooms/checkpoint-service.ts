import type { Room, Rules, Snapshot } from '../domain/types.ts'
import { fail } from '../domain/validation.ts'
import type { PipelineFrame } from '../pipeline/world/frame.ts'
import { HistoryService } from './history-service.ts'

/**
 * Factory checkpoints. A checkpoint is saved each time `checkpointSpendCoins`
 * coins have been spent in the room since the previous one. Restoring is a
 * full rollback of the factory (chunks and pledges included) with no refund.
 */
export class CheckpointService {
  private rules: Readonly<Rules>
  private history: HistoryService
  constructor(rules: Readonly<Rules>, history: HistoryService) {
    this.rules = rules
    this.history = history
  }

  /** Counts coins charged in the room. Call after `room.frame` holds the paid action. */
  recordSpend(room: Room, actorId: string, amount: number) {
    if (!Number.isInteger(amount) || amount < 1) return
    room.checkpointSpend = (room.checkpointSpend ?? 0) + amount
    const threshold = this.rules.pipeline.checkpointSpendCoins
    if (room.checkpointSpend < threshold) return
    const spent = room.checkpointSpend
    room.checkpointSpend = 0
    this.save(room, actorId, 'spend', `Checkpoint após ${spent} moedas gastas`)
  }

  save(room: Room, actorId: string | null, kind: Snapshot['kind'], reason: string) {
    this.history.snapshot(room, actorId, reason, kind)
    this.prune(room)
  }

  find(room: Room, snapshotId: string) {
    const snapshot = room.snapshots.find((item) => item.id === snapshotId)
    if (!snapshot) fail(404, 'Checkpoint não encontrado.')
    return snapshot
  }

  /** Replaces the factory with a checkpoint. The current factory is kept as a `pre-restore` checkpoint. */
  restore(room: Room, snapshot: Snapshot, actorId: string | null, proposalId: string) {
    const current = room.frame
    this.save(room, actorId, 'pre-restore', 'Antes da restauração')
    room.frame = restoredFrame(snapshot.frame, current)
    room.beltCount = room.frame.belts.length
    room.checkpointSpend = 0
    this.history.event(room, 'restore', actorId, {
      snapshotId: snapshot.id,
      proposalId,
      snapshotCreatedAt: snapshot.createdAt,
    })
  }

  /** Public list without the stored frames. */
  summaries(room: Room) {
    return room.snapshots.map((snapshot) => ({
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      actorId: snapshot.actorId,
      reason: snapshot.reason,
      kind: snapshot.kind ?? 'created',
      tick: snapshot.frame.tick,
      deliveries: snapshot.frame.deliveries,
      version: snapshot.frame.version,
      belts: snapshot.frame.belts.length,
      chunks: snapshot.frame.ownedChunks.length,
    }))
  }

  /** Keeps the creation checkpoint, any checkpoint a pending proposal points at, and the newest `checkpointLimit` others. */
  private prune(room: Room) {
    const pinned = new Set(
      room.proposals
        .filter((proposal) => proposal.type === 'restore' && proposal.status === 'pending')
        .map((proposal) => proposal.targetId),
    )
    const rolling = room.snapshots.filter(
      (snapshot) => (snapshot.kind ?? 'created') !== 'created' && !pinned.has(snapshot.id),
    )
    const excess = rolling.length - this.rules.pipeline.checkpointLimit
    if (excess <= 0) return
    const drop = new Set(rolling.slice(0, excess).map((snapshot) => snapshot.id))
    room.snapshots = room.snapshots.filter((snapshot) => !drop.has(snapshot.id))
  }
}

/**
 * Copy of a checkpoint frame that keeps the tick moving forward (clients drop
 * older ticks) and keeps lifetime data that a rollback must not erase.
 */
function restoredFrame(saved: PipelineFrame, current: PipelineFrame): PipelineFrame {
  const frame = structuredClone(saved)
  const shift = current.tick - saved.tick
  frame.tick = current.tick
  const shiftCore = (core: { lastIntakeTick?: number }) => {
    if (core.lastIntakeTick !== undefined) core.lastIntakeTick += shift
  }
  shiftCore(frame.core)
  for (const core of frame.cores ?? []) shiftCore(core)
  // Coins spent are not refunded, so the spend ranking keeps them.
  frame.spentByUserId = current.spentByUserId ? { ...current.spentByUserId } : undefined
  frame.collaborators = structuredClone(current.collaborators)
  return frame
}
