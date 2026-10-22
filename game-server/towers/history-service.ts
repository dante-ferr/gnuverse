import { randomUUID } from 'node:crypto'
import type { Tower } from '../domain/types.ts'
export class HistoryService {
  private now: () => number
  private onChange: (towerId: string) => void
  constructor(now: () => number, onChange: (towerId: string) => void) {
    this.now = now
    this.onChange = onChange
  }
  event(tower: Tower, type: string, actorId: string | null, detail: unknown) {
    tower.events.push({
      id: randomUUID(),
      type,
      actorId,
      detail,
      createdAt: this.now(),
    })
    this.onChange(tower.id)
  }
  snapshot(tower: Tower, actorId: string | null, reason: string) {
    tower.snapshots.push({
      id: randomUUID(),
      createdAt: this.now(),
      blocks: structuredClone(tower.frame.blocks),
      actorId,
      reason,
    })
    this.event(tower, 'snapshot', actorId, {
      snapshotId: tower.snapshots.at(-1)!.id,
      reason,
    })
  }
}
