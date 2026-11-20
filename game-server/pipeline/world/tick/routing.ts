import { Packet } from '../../packets/packet.ts'
import type { PacketShape } from '../../packets/packet.ts'
import type { PortSlot } from '../edit/building-slots.ts'
import type { Match } from '../match.ts'
import { combinerAcceptsShape } from './craft.ts'
import { outputBeltAccepts } from './output-belt.ts'

/** Ejects splitter buffers and advances underground tunnel queues. */
export class Routing {
  private match: Match

  constructor(match: Match) {
    this.match = match
  }

  resolve(options: { phase: number }) {
    if (options.phase === 0) {
      for (const splitter of this.match.splitters) this.ejectSplitter(splitter)
    }
    for (const entrance of this.match.tunnels.filter((portal) => portal.role === 'entrance')) {
      if (entrance.speed <= options.phase) continue
      this.advanceTunnel(entrance)
    }
  }

  private ejectSplitter(splitter: (typeof this.match.splitters)[number]) {
    if (!splitter.buffer) return
    const outputs = splitter.orderedOutputSlots()
    const start = splitter.nextSplitPort
    for (let i = 0; i < outputs.length; i++) {
      const index = ((start + i) % outputs.length) as 0 | 1 | 2
      const slot = outputs[index]
      if (!slot) continue
      if (deliverToLinkedInput(this.match, splitter.origin, slot, splitter.buffer)) {
        splitter.buffer = null
        splitter.nextSplitPort = ((index + 1) % outputs.length) as 0 | 1 | 2
        return
      }
      if (!outputBeltAccepts(this.match, slot.cell, slot.travel)) continue
      placePacket(this.match, slot.cell, splitter.buffer)
      splitter.buffer = null
      splitter.nextSplitPort = ((index + 1) % outputs.length) as 0 | 1 | 2
      return
    }
  }

  private advanceTunnel(entrance: (typeof this.match.tunnels)[number]) {
    const exit = this.match.tunnels.find(
      (portal) => portal.pairId === entrance.pairId && portal.role === 'exit',
    )
    if (!exit) return
    const slots = entrance.queue
    if (slots.length === 0) return

    const out = exit.outputSlots()[0]
    if (!out) return
    const end = slots.length - 1
    if (slots[end] && deliverTunnelExit(this.match, exit.origin, out, slots[end]!)) {
      slots[end] = null
    }
    for (let i = end; i > 0; i--) {
      if (!slots[i] && slots[i - 1]) {
        slots[i] = slots[i - 1]!
        slots[i - 1] = null
      }
    }
  }
}

/**
 * Direct port plug first, then a belt on the output cell.
 * `from` is the cell the output attaches to (source rim, machine body, tunnel exit).
 */
export function ejectOnto(
  match: Match,
  from: { x: number; y: number },
  output: PortSlot,
  shape: PacketShape,
) {
  if (deliverToLinkedInput(match, from, output, shape)) return true
  if (!outputBeltAccepts(match, output.cell, output.travel)) return false
  placePacket(match, output.cell, shape)
  return true
}

/** Port plug first, then a belt on the output cell. */
function deliverToLinkedInput(
  match: Match,
  from: { x: number; y: number },
  output: PortSlot,
  shape: PacketShape,
) {
  for (const core of match.cores) {
    for (const slot of core.inputSlots()) {
      if (!outputReaches(from, output, slot, match)) continue
      if (!match.acceptsDelivery(shape)) return false
      match.recordDelivery(shape, core.id)
      return true
    }
  }
  for (const combiner of match.combiners) {
    for (const slot of combiner.inputSlots()) {
      if (!outputReaches(from, output, slot, match)) continue
      if (!combinerAcceptsShape(combiner, match.rules, shape)) return false
      combiner.buffer[shape] = (combiner.buffer[shape] ?? 0) + 1
      return true
    }
  }
  for (const other of match.splitters) {
    if (other.origin.x === from.x && other.origin.y === from.y) continue
    for (const slot of other.inputSlots()) {
      if (!outputReaches(from, output, slot, match)) continue
      if (other.buffer !== null) return false
      other.buffer = shape
      return true
    }
  }
  for (const trashcan of match.trashcans) {
    for (const slot of trashcan.inputSlots()) {
      if (!outputReaches(from, output, slot, match)) continue
      return true
    }
  }
  for (const portal of match.tunnels) {
    if (portal.role !== 'entrance') continue
    for (const slot of portal.inputSlots()) {
      if (!outputReaches(from, output, slot, match)) continue
      return tunnelAbsorb(match, portal.pairId, shape)
    }
  }
  return false
}

function deliverTunnelExit(
  match: Match,
  from: { x: number; y: number },
  output: PortSlot,
  shape: PacketShape,
) {
  if (deliverToLinkedInput(match, from, output, shape)) return true
  if (!outputBeltAccepts(match, output.cell, output.travel)) return false
  placePacket(match, output.cell, shape)
  return true
}

function canDeliverToLinkedInput(
  match: Match,
  from: { x: number; y: number },
  output: PortSlot,
  shape: PacketShape,
) {
  for (const core of match.cores) {
    for (const slot of core.inputSlots()) {
      if (!outputReaches(from, output, slot, match)) continue
      return match.acceptsDelivery(shape)
    }
  }
  for (const combiner of match.combiners) {
    for (const slot of combiner.inputSlots()) {
      if (!outputReaches(from, output, slot, match)) continue
      if (!combinerAcceptsShape(combiner, match.rules, shape)) return false
      return true
    }
  }
  for (const other of match.splitters) {
    if (other.origin.x === from.x && other.origin.y === from.y) continue
    for (const slot of other.inputSlots()) {
      if (!outputReaches(from, output, slot, match)) continue
      if (other.buffer !== null) return false
      return true
    }
  }
  for (const trashcan of match.trashcans) {
    for (const slot of trashcan.inputSlots()) {
      if (!outputReaches(from, output, slot, match)) continue
      return true
    }
  }
  for (const portal of match.tunnels) {
    if (portal.role !== 'entrance') continue
    for (const slot of portal.inputSlots()) {
      if (!outputReaches(from, output, slot, match)) continue
      return tunnelCanAbsorb(match, portal.pairId, shape)
    }
  }
  return false
}

function canDeliverTunnelExit(
  match: Match,
  from: { x: number; y: number },
  output: PortSlot,
  shape: PacketShape,
) {
  if (canDeliverToLinkedInput(match, from, output, shape)) return true
  return outputBeltAccepts(match, output.cell, output.travel)
}

function placePacket(match: Match, cell: { x: number; y: number }, shape: PacketShape) {
  const id = `p${match.nextPacketId++}`
  match.packets.push(new Packet(id, { ...cell }, shape))
}

/**
 * Direct plug only: the output cell is the input slot and travel matches
 * (zero empty cells). A one-cell gap is a belt, not a link — including
 * tunnels. `from` is unused; callers still pass the emitting body.
 */
function outputReaches(
  _from: { x: number; y: number },
  output: PortSlot,
  input: PortSlot,
  _match: Match,
) {
  if (input.role !== 'input' || output.role !== 'output') return false
  return (
    output.cell.x === input.cell.x &&
    output.cell.y === input.cell.y &&
    output.travel === input.travel
  )
}

/** True when the tunnel entrance queue can accept one more packet this tick. */
export function tunnelCanAbsorb(match: Match, pairId: string, shape?: PacketShape) {
  const entrance = match.tunnels.find(
    (portal) => portal.pairId === pairId && portal.role === 'entrance',
  )
  if (!entrance) return false
  if (entrance.queue.length > 0) return entrance.queue[0] == null
  const exit = match.tunnels.find(
    (portal) => portal.pairId === pairId && portal.role === 'exit',
  )
  if (!exit || shape === undefined) return false
  const out = exit.outputSlots()[0]
  if (!out) return false
  return canDeliverTunnelExit(match, exit.origin, out, shape)
}

export function tunnelAbsorb(match: Match, pairId: string, shape: PacketShape) {
  const entrance = match.tunnels.find(
    (portal) => portal.pairId === pairId && portal.role === 'entrance',
  )
  if (!entrance) return false
  if (entrance.queue.length > 0) {
    if (entrance.queue[0] != null) return false
    entrance.queue[0] = shape
    entrance.noteIngress(shape)
    return true
  }
  const exit = match.tunnels.find(
    (portal) => portal.pairId === pairId && portal.role === 'exit',
  )
  if (!exit) return false
  const out = exit.outputSlots()[0]
  if (!out) return false
  if (!deliverTunnelExit(match, exit.origin, out, shape)) return false
  entrance.noteIngress(shape)
  return true
}