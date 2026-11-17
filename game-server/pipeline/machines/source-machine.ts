import { ahead, type Direction } from '../geometry/direction.ts'
import type { Cell } from '../geometry/cell.ts'
import type { PacketShape } from '../packets/packet.ts'
import { Machine } from './machine.ts'
import { Slot } from './slot.ts'

/** Fixed emitter with a single output slot on the neighboring cell. */
export class SourceMachine extends Machine {
  readonly kind = 'source'
  static readonly size = 3
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
    super(id, origin, SourceMachine.size, SourceMachine.size)
    this.direction = direction
    this.shape = shape
    this.periodTicks = periodTicks
    this.ticksUntilEmit = ticksUntilEmit
    const face = faceCenter(direction)
    const rim = { x: origin.x + face.x, y: origin.y + face.y }
    const output = ahead(rim.x, rim.y, direction)
    this.addSlot(new Slot(`${id}:out`, 'output', output, direction))
  }
}

function faceCenter(direction: Direction): Cell {
  const mid = Math.floor(SourceMachine.size / 2)
  if (direction === 'east') return { x: SourceMachine.size - 1, y: mid }
  if (direction === 'west') return { x: 0, y: mid }
  if (direction === 'south') return { x: mid, y: SourceMachine.size - 1 }
  return { x: mid, y: 0 }
}
