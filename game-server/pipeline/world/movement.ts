import { cellKey } from '../geometry/cell.ts'
import type { PacketShape } from '../packets/packet.ts'
import type { Packet } from '../packets/packet.ts'
import { remainingDemand } from './demands.ts'
import { mergeInputs } from './merge.ts'
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
        to: this.destination(output.cell, packet.shape),
      })
    }
    const allowed = this.allowed(moves, occupied)
    const deliveredIds = new Set<string>()
    for (const move of allowed) {
      if (move.to === 'deliver') {
        deliveredIds.add(move.packet.id)
        this.match.recordDelivery(move.packet.shape)
        continue
      }
      const [x, y] = move.to.split(',').map(Number)
      move.packet.cell = { x, y }
    }
    if (deliveredIds.size > 0)
      this.match.packets = this.match.packets.filter((packet) => !deliveredIds.has(packet.id))
    return deliveredIds.size
  }

  private destination(cell: { x: number; y: number }, shape: PacketShape) {
    if (this.match.core.slotAt(cell, 'input')) {
      if (!this.match.acceptsDelivery(shape)) return 'blocked'
      return 'deliver'
    }
    if (!this.match.inBounds(cell) || !this.match.beltAt(cell)) return 'blocked'
    return cellKey(cell)
  }

  /** Extra packets past the remaining quota stay on their belt cell. */
  private capDeliveries(moves: Move[]) {
    const budget = new Map<PacketShape, number>()
    const kept: Move[] = []
    for (const move of moves) {
      if (move.to !== 'deliver') {
        kept.push(move)
        continue
      }
      const shape = move.packet.shape
      if (!budget.has(shape)) {
        budget.set(
          shape,
          remainingDemand(this.match.rules, this.match.version, shape, this.match.deliveryByShape),
        )
      }
      const left = budget.get(shape) ?? 0
      if (left <= 0) continue
      budget.set(shape, left - 1)
      kept.push(move)
    }
    return kept
  }

  private allowed(moves: Move[], occupied: Map<string, Packet>) {
    let active = this.capDeliveries(moves.filter((move) => move.to !== 'blocked'))
    let changed = true
    while (changed) {
      changed = false
      const leaving = new Set(active.map((move) => move.from))
      const byDest = new Map<string, Move[]>()
      const next: Move[] = []
      for (const move of active) {
        if (move.to === 'deliver') {
          next.push(move)
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
        const group = byDest.get(move.to)
        if (group) group.push(move)
        else byDest.set(move.to, [move])
      }
      for (const [dest, group] of byDest) {
        const winner = this.pickMergeWinner(dest, group)
        if (!winner) {
          changed = true
          continue
        }
        if (group.length > 1) changed = true
        next.push(winner)
      }
      active = next
    }
    return active
  }

  /**
   * Round-robin among up to three NESW inbound belts. Skips empty inputs;
   * advances `mergeLast` when a packet enters.
   */
  private pickMergeWinner(dest: string, group: Move[]): Move | undefined {
    const [x, y] = dest.split(',').map(Number)
    const inputs = mergeInputs(this.match, { x: x!, y: y! })
    const order = inputs.map((belt) => cellKey(belt.origin))
    const allowed = new Set(order)
    const eligible = group.filter((move) => allowed.has(move.from))
    if (eligible.length === 0) return undefined

    const last = this.match.mergeLast[dest]
    let start = 0
    if (last) {
      const idx = order.indexOf(last)
      if (idx >= 0) start = (idx + 1) % order.length
    }
    for (let i = 0; i < order.length; i++) {
      const key = order[(start + i) % order.length]!
      const hit = eligible.find((move) => move.from === key)
      if (hit) {
        this.match.mergeLast[dest] = hit.from
        return hit
      }
    }
    return undefined
  }
}
