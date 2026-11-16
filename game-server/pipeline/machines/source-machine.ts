import { ahead, type Direction } from '../geometry/direction.ts'
import type { Cell } from '../geometry/cell.ts'
import type { PacketShape } from '../packets/packet.ts'
import { Machine } from './machine.ts'
import { Slot } from './slot.ts'

/** Fixed emitter with a single output slot on the neighboring cell. */
export class SourceMachine extends Machine {
  readonly kind = 'source'
  readonly direction: Direction
  readonly shape: PacketShape
  readonly periodTicks: number
  ticksUntilEmit: number

  constructor(
    id: string,
    origin: Cell,
    direction: Direction,
    shape: PacketShape,
    periodTicks: number,
    ticksUntilEmit = 0,
  ) {
    super(id, origin, 1, 1)
    this.direction = direction
    this.shape = shape
    this.periodTicks = periodTicks
    this.ticksUntilEmit = ticksUntilEmit
    const output = ahead(origin.x, origin.y, direction)
    this.addSlot(new Slot(`${id}:out`, 'output', output, direction))
  }
}
