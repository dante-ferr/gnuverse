import type { Cell } from '../geometry/cell.ts'
import { ahead, opposite, type Direction } from '../geometry/direction.ts'
import type { PacketShape } from '../packets/packet.ts'
import { Machine } from './machine.ts'
import { Slot } from './slot.ts'

export type TunnelPortalRole = 'entrance' | 'exit'

/**
 * Factorio-style underground belt portal (1×1).
 * Entrance and exit share a pair id and face the same travel direction.
 */
export class TunnelPortalMachine extends Machine {
  readonly kind = 'tunnel'
  readonly role: TunnelPortalRole
  readonly pairId: string
  readonly direction: Direction
  readonly authorId: string
  readonly authorNickname: string
  /**
   * Underground lane slots (length = gap). Only the entrance owns the live array.
   * Null entries are empty; packets shift toward the exit each tick.
   */
  queue: (PacketShape | null)[] = []

  constructor(
    id: string,
    origin: Cell,
    role: TunnelPortalRole,
    pairId: string,
    direction: Direction,
    author: { id: string; nickname: string },
    capacity = 0,
  ) {
    super(id, origin, 1, 1)
    this.role = role
    this.pairId = pairId
    this.direction = direction
    this.authorId = author.id
    this.authorNickname = author.nickname
    if (role === 'entrance' && capacity > 0) {
      this.queue = Array.from({ length: capacity }, () => null)
    }
    if (role === 'entrance') {
      this.addSlot(new Slot(`${id}:in`, 'input', origin, direction))
    } else {
      const out = ahead(origin.x, origin.y, direction)
      this.addSlot(new Slot(`${id}:out`, 'output', out, direction))
    }
  }

  /** Cell one step behind the entrance (inbound approach). */
  static approachCell(origin: Cell, direction: Direction): Cell {
    return ahead(origin.x, origin.y, opposite(direction))
  }
}

/** True when exit lies on the travel ray from entrance within max gap. */
export function tunnelPairGeometry(
  entrance: Cell,
  exit: Cell,
  direction: Direction,
  maxGap: number,
): { ok: true; gap: number } | { ok: false; reason: string } {
  const dx = exit.x - entrance.x
  const dy = exit.y - entrance.y
  if (direction === 'east') {
    if (dy !== 0 || dx < 1) return { ok: false, reason: 'Saída do túnel inválida.' }
    const gap = dx - 1
    if (gap < 0 || gap > maxGap) return { ok: false, reason: 'Distância do túnel inválida.' }
    return { ok: true, gap }
  }
  if (direction === 'west') {
    if (dy !== 0 || dx > -1) return { ok: false, reason: 'Saída do túnel inválida.' }
    const gap = -dx - 1
    if (gap < 0 || gap > maxGap) return { ok: false, reason: 'Distância do túnel inválida.' }
    return { ok: true, gap }
  }
  if (direction === 'south') {
    if (dx !== 0 || dy < 1) return { ok: false, reason: 'Saída do túnel inválida.' }
    const gap = dy - 1
    if (gap < 0 || gap > maxGap) return { ok: false, reason: 'Distância do túnel inválida.' }
    return { ok: true, gap }
  }
  if (dx !== 0 || dy > -1) return { ok: false, reason: 'Saída do túnel inválida.' }
  const gap = -dy - 1
  if (gap < 0 || gap > maxGap) return { ok: false, reason: 'Distância do túnel inválida.' }
  return { ok: true, gap }
}
