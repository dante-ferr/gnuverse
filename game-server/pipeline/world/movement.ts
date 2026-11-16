import { cellKey } from '../geometry/cell.ts'
import type { BeltMachine } from '../machines/belt-machine.ts'
import type { Packet } from '../packets/packet.ts'
import type { Match } from './match.ts'

type Move = { packet: Packet; from: string; to: string }

/** Moves every belt packet at once. Packets do not swap places. */
export class Movement {
  private match: Match

  constructor(match: Match) {
    this.match = match
  }

  resolve() {
    const occupied = new Map<string, Packet>()
    for (const packet of this.match.packets) occupied.set(cellKey(packet.cell), packet)
    const moves: Move[] = []
    for (const belt of this.match.belts) {
      const packet = occupied.get(cellKey(belt.origin))
      if (!packet) continue
      const output = belt.outputSlots()[0]
      if (!output) continue
      moves.push({
        packet,
        from: cellKey(belt.origin),
        to: this.destination(output.cell),
      })
    }
    const allowed = this.allowed(moves, occupied)
    const deliveredIds = new Set<string>()
    for (const move of allowed) {
      if (move.to === 'deliver') {
        deliveredIds.add(move.packet.id)
        continue
      }
      const [x, y] = move.to.split(',').map(Number)
      move.packet.cell = { x, y }
    }
    if (deliveredIds.size > 0)
      this.match.packets = this.match.packets.filter((packet) => !deliveredIds.has(packet.id))
    return deliveredIds.size
  }

  private destination(cell: { x: number; y: number }) {
    if (this.match.core.slotAt(cell, 'input')) return 'deliver'
    if (!this.match.inBounds(cell) || !this.match.beltAt(cell)) return 'blocked'
    return cellKey(cell)
  }

  private allowed(moves: Move[], occupied: Map<string, Packet>) {
    let active = moves.filter((move) => move.to !== 'blocked')
    let changed = true
    while (changed) {
      changed = false
      const counts = new Map<string, number>()
      for (const move of active) {
        if (move.to === 'deliver') continue
        counts.set(move.to, (counts.get(move.to) ?? 0) + 1)
      }
      const leaving = new Set(active.map((move) => move.from))
      const next: Move[] = []
      for (const move of active) {
        if (move.to !== 'deliver') {
          if ((counts.get(move.to) ?? 0) > 1) {
            changed = true
            continue
          }
          const occupant = occupied.get(move.to)
          if (occupant && !leaving.has(move.to)) {
            changed = true
            continue
          }
          const reverse = active.find((other) => other.from === move.to && other.to === move.from)
          if (reverse) {
            changed = true
            continue
          }
        }
        next.push(move)
      }
      active = next
    }
    return active
  }
}
