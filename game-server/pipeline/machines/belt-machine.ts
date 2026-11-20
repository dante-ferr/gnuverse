import { ahead, type Direction } from '../geometry/direction.ts'
import type { Cell } from '../geometry/cell.ts'
import { Machine } from './machine.ts'
import { Slot } from './slot.ts'

/** A player belt: one input on its own cell and one output on the next cell. */
export class BeltMachine extends Machine {
  readonly kind = 'belt'
  readonly direction: Direction
  readonly speed: number
  readonly placedAt: number
  readonly authorId: string
  readonly authorNickname: string

  constructor(
    id: string,
    origin: Cell,
    direction: Direction,
    author: { id: string; nickname: string; placedAt: number },
    speed = 1,
  ) {
    super(id, origin, 1, 1)
    this.direction = direction
    this.speed = speed
    this.placedAt = author.placedAt
    this.authorId = author.id
    this.authorNickname = author.nickname
    this.addSlot(new Slot(`${id}:in`, 'input', origin, direction))
    this.addSlot(new Slot(`${id}:out`, 'output', ahead(origin.x, origin.y, direction), direction))
  }
}
