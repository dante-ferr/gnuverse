import type { Cell } from '../geometry/cell.ts'
import { ahead, leftOf, rightOf, type Direction } from '../geometry/direction.ts'
import type { PacketShape } from '../packets/packet.ts'
import { Machine } from './machine.ts'
import { Slot } from './slot.ts'

/** 1×1 round-robin splitter: one inbound face, three outbound neighbors. */
export class SplitterMachine extends Machine {
  readonly kind = 'splitter'
  readonly facing: Direction
  readonly authorId: string
  readonly authorNickname: string
  nextSplitPort: 0 | 1 | 2 = 0
  /** Single buffered packet waiting to eject (null when empty). */
  buffer: PacketShape | null = null

  constructor(
    id: string,
    origin: Cell,
    facing: Direction,
    author: { id: string; nickname: string },
  ) {
    super(id, origin, 1, 1)
    this.facing = facing
    this.authorId = author.id
    this.authorNickname = author.nickname
    this.addSlot(new Slot(`${id}:in`, 'input', origin, facing))
    const ports: Direction[] = [leftOf(facing), facing, rightOf(facing)]
    for (let i = 0; i < ports.length; i++) {
      const travel = ports[i]!
      const cell = ahead(origin.x, origin.y, travel)
      this.addSlot(new Slot(`${id}:out:${i}`, 'output', cell, travel))
    }
  }

  /** Output slots in RR order: left, forward, right. */
  orderedOutputSlots(): Slot[] {
    return this.outputSlots().slice().sort((a, b) => a.id.localeCompare(b.id))
  }
}
