import { cellKey, sameCell } from '../../geometry/cell.ts'
import { ahead, opposite } from '../../geometry/direction.ts'
import type { PacketShape } from '../../packets/packet.ts'
import type { Packet } from '../../packets/packet.ts'
import { matchDemandProgress, remainingDemand } from '../progression/demands.ts'
import type { Match } from '../match.ts'
import { combinerAcceptsShape } from './craft.ts'
import { mergeInputs } from './merge.ts'
import { tunnelAbsorb, tunnelCanAbsorb } from './routing.ts'

type Move = { packet: Packet; from: string; to: string }

type ApproachTarget =
  | { kind: 'core'; machine: Match['cores'][number] }
  | { kind: 'combiner'; machine: Match['combiners'][number] }
  | { kind: 'splitter'; machine: Match['splitters'][number] }
  | { kind: 'trashcan'; machine: Match['trashcans'][number] }
  | { kind: 'tunnel'; machine: Match['tunnels'][number] }

export type PullFlowChoice = 'pull' | 'flow'

/** Moves every belt packet at once. Packets do not swap places. */
export class Movement {
  private match: Match

  constructor(match: Match) {
    this.match = match
  }

  resolve(options: { phase: number }) {
    const occupied = new Map<string, Packet>()
    for (const packet of this.match.packets) occupied.set(cellKey(packet.cell), packet)
    const moves: Move[] = []
    for (const belt of this.match.belts) {
      if (belt.speed <= options.phase) continue
      const packet = occupied.get(cellKey(belt.origin))
      if (!packet) continue
      const output = belt.outputSlots()[0]
      if (!output) continue
      moves.push({
        packet,
        from: cellKey(belt.origin),
        to: this.chooseDestination(belt.origin, output.cell, packet.shape),
      })
    }
    const allowed = this.allowed(moves, occupied)
    const deliveredIds = new Set<string>()
    const absorbedIds = new Set<string>()
    for (const move of allowed) {
      if (move.to.startsWith('deliver:')) {
        deliveredIds.add(move.packet.id)
        this.match.recordDelivery(move.packet.shape, move.to.slice('deliver:'.length))
        continue
      }
      if (move.to.startsWith('absorb:combiner:')) {
        const combinerId = move.to.slice('absorb:combiner:'.length)
        const combiner = this.match.combiners.find((machine) => machine.id === combinerId)
        if (!combiner || !combinerAcceptsShape(combiner, this.match.rules, move.packet.shape)) {
          continue
        }
        combiner.buffer[move.packet.shape] = (combiner.buffer[move.packet.shape] ?? 0) + 1
        absorbedIds.add(move.packet.id)
        continue
      }
      if (move.to.startsWith('absorb:splitter:')) {
        const splitterId = move.to.slice('absorb:splitter:'.length)
        const splitter = this.match.splitters.find((machine) => machine.id === splitterId)
        if (!splitter || splitter.buffer !== null) continue
        splitter.buffer = move.packet.shape
        absorbedIds.add(move.packet.id)
        continue
      }
      if (move.to.startsWith('absorb:trashcan:')) {
        absorbedIds.add(move.packet.id)
        continue
      }
      if (move.to.startsWith('absorb:tunnel:')) {
        const pairId = move.to.slice('absorb:tunnel:'.length)
        if (!tunnelAbsorb(this.match, pairId, move.packet.shape)) continue
        absorbedIds.add(move.packet.id)
        continue
      }
      const [x, y] = move.to.split(',').map(Number)
      move.packet.cell = { x, y }
    }
  if (deliveredIds.size > 0 || absorbedIds.size > 0) {
      const remove = new Set([...deliveredIds, ...absorbedIds])
      this.match.packets = this.match.packets.filter((packet) => !remove.has(packet.id))
    }
    return deliveredIds.size
  }

  /**
   * Prefer input pull when the belt sits on an approach cell, round-robin with
   * the belt’s natural forward destination when both are available.
   */
  private chooseDestination(
    origin: { x: number; y: number },
    outputCell: { x: number; y: number },
    shape: PacketShape,
  ) {
    const flow = this.destination(outputCell, shape, origin)
    const pull = this.pullFromApproach(origin, shape)
    if (!pull) return flow
    if (flow === 'blocked') return pull
    if (flow === pull) return pull
    return this.pickPullFlowWinner(cellKey(origin), pull, flow)
  }

  /**
   * If `cell` sits one step outside an accepting input, return that input’s
   * deliver/absorb target. Returns null when the cell is not an approach or
   * the input cannot take the packet this tick.
   */
  private pullFromApproach(cell: { x: number; y: number }, shape: PacketShape): string | null {
    const target = this.approachIndex().get(cellKey(cell))
    if (!target) return null
    switch (target.kind) {
      case 'core':
        return this.match.acceptsDelivery(shape) ? `deliver:${target.machine.id}` : null
      case 'combiner':
        return combinerAcceptsShape(target.machine, this.match.rules, shape)
          ? `absorb:combiner:${target.machine.id}`
          : null
      case 'splitter':
        return target.machine.buffer === null ? `absorb:splitter:${target.machine.id}` : null
      case 'trashcan':
        return `absorb:trashcan:${target.machine.id}`
      case 'tunnel':
        return tunnelCanAbsorb(this.match, target.machine.pairId, shape)
          ? `absorb:tunnel:${target.machine.pairId}`
          : null
    }
  }

  private approaches?: Map<string, ApproachTarget>

  /**
   * Approach cell → first input that owns it, in core, combiner, splitter,
   * trashcan, tunnel order. Machines do not move during a movement pass.
   */
  private approachIndex() {
    if (this.approaches) return this.approaches
    const index = new Map<string, ApproachTarget>()
    const add = (target: ApproachTarget) => {
      for (const slot of target.machine.inputSlots()) {
        const key = cellKey(ahead(slot.cell.x, slot.cell.y, opposite(slot.travel)))
        if (!index.has(key)) index.set(key, target)
      }
    }
    for (const machine of this.match.cores) add({ kind: 'core', machine })
    for (const machine of this.match.combiners) add({ kind: 'combiner', machine })
    for (const machine of this.match.splitters) add({ kind: 'splitter', machine })
    for (const machine of this.match.trashcans) add({ kind: 'trashcan', machine })
    for (const machine of this.match.tunnels)
      if (machine.role === 'entrance') add({ kind: 'tunnel', machine })
    this.approaches = index
    return index
  }

  /** Round-robin between input pull and belt-forward flow for one approach cell. */
  private pickPullFlowWinner(fromKey: string, pull: string, flow: string) {
    const order: PullFlowChoice[] = ['pull', 'flow']
    const targets: Record<PullFlowChoice, string> = { pull, flow }
    const last = this.match.pullLast[fromKey]
    let start = 0
    if (last === 'pull') start = 1
    else if (last === 'flow') start = 0
    for (let i = 0; i < order.length; i++) {
      const choice = order[(start + i) % order.length]!
      const to = targets[choice]
      if (to === 'blocked') continue
      this.match.pullLast[fromKey] = choice
      return to
    }
    return 'blocked'
  }

  /**
   * Forward hop from `from`. An input only accepts the hop when `from` is that
   * input’s approach cell (directly behind it). Other belts that merely point
   * at the slot stay blocked — they are not inputs.
   */
  private destination(
    cell: { x: number; y: number },
    shape: PacketShape,
    from: { x: number; y: number },
  ) {
    for (const core of this.match.cores) {
      const slot = core.slotAt(cell, 'input')
      if (!slot) continue
      if (!sameCell(from, ahead(slot.cell.x, slot.cell.y, opposite(slot.travel)))) return 'blocked'
      if (!this.match.acceptsDelivery(shape)) return 'blocked'
      return `deliver:${core.id}`
    }
    for (const combiner of this.match.combiners) {
      const slot = combiner.slotAt(cell, 'input')
      if (!slot) continue
      if (!sameCell(from, ahead(slot.cell.x, slot.cell.y, opposite(slot.travel)))) return 'blocked'
      if (!combinerAcceptsShape(combiner, this.match.rules, shape)) return 'blocked'
      return `absorb:combiner:${combiner.id}`
    }
    for (const splitter of this.match.splitters) {
      const slot = splitter.slotAt(cell, 'input')
      if (!slot) continue
      if (!sameCell(from, ahead(slot.cell.x, slot.cell.y, opposite(slot.travel)))) return 'blocked'
      if (splitter.buffer !== null) return 'blocked'
      return `absorb:splitter:${splitter.id}`
    }
    for (const trashcan of this.match.trashcans) {
      const slot = trashcan.slotAt(cell, 'input')
      if (!slot) continue
      if (!sameCell(from, ahead(slot.cell.x, slot.cell.y, opposite(slot.travel)))) return 'blocked'
      return `absorb:trashcan:${trashcan.id}`
    }
    for (const portal of this.match.tunnels) {
      if (portal.role !== 'entrance') continue
      const slot = portal.slotAt(cell, 'input')
      if (!slot) continue
      if (!sameCell(from, ahead(slot.cell.x, slot.cell.y, opposite(slot.travel)))) return 'blocked'
      if (!tunnelCanAbsorb(this.match, portal.pairId, shape)) return 'blocked'
      return `absorb:tunnel:${portal.pairId}`
    }
    if (!this.match.inBounds(cell) || !this.match.beltAt(cell)) return 'blocked'
    return cellKey(cell)
  }

  /** Extra packets past the remaining quota stay on their belt cell. */
  private capDeliveries(moves: Move[]) {
    const budget = new Map<PacketShape, number>()
    const kept: Move[] = []
    for (const move of moves) {
      if (!move.to.startsWith('deliver:')) {
        kept.push(move)
        continue
      }
      const shape = move.packet.shape
      if (!budget.has(shape)) {
        budget.set(
          shape,
          remainingDemand(this.match.rules, matchDemandProgress(this.match), shape),
        )
      }
      const left = budget.get(shape) ?? 0
      if (left <= 0) continue
      budget.set(shape, left - 1)
      kept.push(move)
    }
    return kept
  }

  /**
   * One arbitration pass, then backward propagation: a move that cannot leave
   * its cell blocks the single merge winner that targets that cell, and so on
   * up the chain. Same result and order as re-running the pass to a fixed
   * point, but linear in the number of moves instead of cubic on long jams.
   */
  private allowed(moves: Move[], occupied: Map<string, Packet>) {
    const active = this.capDeliveries(moves.filter((move) => move.to !== 'blocked'))
    // One packet per cell, so `from` is unique among moves.
    const byFrom = new Map<string, Move>()
    for (const move of active) byFrom.set(move.from, move)
    const byDest = new Map<string, Move[]>()
    const next: Move[] = []
    const stuck: string[] = []
    for (const move of active) {
      if (move.to.startsWith('deliver:') || move.to.startsWith('absorb:')) {
        next.push(move)
        continue
      }
      if (occupied.has(move.to) && !byFrom.has(move.to)) {
        stuck.push(move.from)
        continue
      }
      if (byFrom.get(move.to)?.to === move.from) {
        stuck.push(move.from)
        continue
      }
      const group = byDest.get(move.to)
      if (group) group.push(move)
      else byDest.set(move.to, [move])
    }
    const winnerByDest = new Map<string, Move>()
    for (const [dest, group] of byDest) {
      const winner = this.pickMergeWinner(dest, group)
      for (const move of group) if (move !== winner) stuck.push(move.from)
      if (!winner) continue
      winnerByDest.set(dest, winner)
      next.push(winner)
    }
    // A stuck move keeps its packet in place, so whoever won that cell is blocked too.
    const removed = new Set<Move>()
    while (stuck.length > 0) {
      const cell = stuck.pop()!
      const winner = winnerByDest.get(cell)
      if (!winner || removed.has(winner)) continue
      removed.add(winner)
      stuck.push(winner.from)
    }
    return removed.size === 0 ? next : next.filter((move) => !removed.has(move))
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