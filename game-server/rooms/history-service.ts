import { randomUUID } from 'node:crypto'
import type { Room, Snapshot } from '../domain/types.ts'
export class HistoryService {
  private now: () => number
  private onChange: (roomId: string) => void
  constructor(now: () => number, onChange: (roomId: string) => void) {
    this.now = now
    this.onChange = onChange
  }
  event(room: Room, type: string, actorId: string | null, detail: unknown) {
    room.events.push({
      id: randomUUID(),
      type,
      actorId,
      detail,
      createdAt: this.now(),
    })
    this.onChange(room.id)
  }
  snapshot(
    room: Room,
    actorId: string | null,
    reason: string,
    kind: Snapshot['kind'] = 'created',
  ) {
    room.snapshots.push({
      id: randomUUID(),
      createdAt: this.now(),
      frame: structuredClone(room.frame),
      actorId,
      reason,
      kind,
    })
    this.event(room, 'snapshot', actorId, {
      snapshotId: room.snapshots.at(-1)!.id,
      reason,
      kind,
    })
  }
}
