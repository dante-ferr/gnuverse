export type PresenceCell = { x: number; y: number }

export type PresencePlayer = {
  id: string
  nickname: string
  /** Last cell this player edited since arriving, or null if none yet. */
  cell: PresenceCell | null
}

type Entry = { nickname: string; seenAt: number; cell: PresenceCell | null }

/** A player counts as in the room while heartbeats keep arriving within this window. */
export const PRESENCE_TTL_MS = 40_000

/** In-memory presence per room. Deliberately not persisted: it only describes who is here now. */
export class RoomPresence {
  private rooms = new Map<string, Map<string, Entry>>()

  /** Returns true when the visible snapshot changed (new arrival). */
  touch(roomId: string, user: { id: string; nickname: string }, now = Date.now()) {
    const room = this.rooms.get(roomId) ?? new Map<string, Entry>()
    this.rooms.set(roomId, room)
    const entry = room.get(user.id)
    if (entry) {
      const renamed = entry.nickname !== user.nickname
      entry.seenAt = now
      entry.nickname = user.nickname
      return renamed
    }
    room.set(user.id, { nickname: user.nickname, seenAt: now, cell: null })
    return true
  }

  noteEdit(
    roomId: string,
    user: { id: string; nickname: string },
    cell: PresenceCell,
    now = Date.now(),
  ) {
    this.touch(roomId, user, now)
    this.rooms.get(roomId)!.get(user.id)!.cell = { x: cell.x, y: cell.y }
  }

  /** Drops stale players. Returns the room ids whose snapshot changed. */
  sweep(now = Date.now()) {
    const changed: string[] = []
    for (const [roomId, room] of this.rooms) {
      let dropped = false
      for (const [id, entry] of room) {
        if (now - entry.seenAt <= PRESENCE_TTL_MS) continue
        room.delete(id)
        dropped = true
      }
      if (room.size === 0) this.rooms.delete(roomId)
      if (dropped) changed.push(roomId)
    }
    return changed
  }

  snapshot(roomId: string): PresencePlayer[] {
    return [...(this.rooms.get(roomId) ?? [])].map(([id, entry]) => ({
      id,
      nickname: entry.nickname,
      cell: entry.cell ? { ...entry.cell } : null,
    }))
  }

  clear(roomId: string) {
    this.rooms.delete(roomId)
  }
}
