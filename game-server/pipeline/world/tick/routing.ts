import { Packet } from '../../packets/packet.ts'
import type { PacketShape } from '../../packets/packet.ts'
import type { Match } from '../match.ts'
import { outputBeltAccepts } from './output-belt.ts'

/** Ejects splitter buffers and advances underground tunnel queues. */
export class Routing {
  private match: Match

  constructor(match: Match) {
    this.match = match
  }

  resolve() {
    for (const splitter of this.match.splitters) this.ejectSplitter(splitter)
    for (const entrance of this.match.tunnels.filter((portal) => portal.role === 'entrance')) {
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
      if (!slot || !outputBeltAccepts(this.match, slot.cell, slot.travel)) continue
      this.placePacket(slot.cell, splitter.buffer)
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
    if (slots[end] && outputBeltAccepts(this.match, out.cell, out.travel)) {
      this.placePacket(out.cell, slots[end]!)
      slots[end] = null
    }
    for (let i = end; i > 0; i--) {
      if (!slots[i] && slots[i - 1]) {
        slots[i] = slots[i - 1]!
        slots[i - 1] = null
      }
    }
  }

  private placePacket(cell: { x: number; y: number }, shape: PacketShape) {
    const id = `p${this.match.nextPacketId++}`
    this.match.packets.push(new Packet(id, { ...cell }, shape))
  }
}

/** True when the tunnel entrance queue can accept one more packet this tick. */
export function tunnelCanAbsorb(match: Match, pairId: string) {
  const entrance = match.tunnels.find(
    (portal) => portal.pairId === pairId && portal.role === 'entrance',
  )
  if (!entrance || entrance.queue.length === 0) return false
  return entrance.queue[0] == null
}

export function tunnelAbsorb(match: Match, pairId: string, shape: PacketShape) {
  const entrance = match.tunnels.find(
    (portal) => portal.pairId === pairId && portal.role === 'entrance',
  )
  if (!entrance || entrance.queue[0] != null) return false
  entrance.queue[0] = shape
  return true
}
