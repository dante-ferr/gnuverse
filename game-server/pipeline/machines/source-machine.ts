import { ahead, type Direction } from '../geometry/direction.ts'
import type { Cell } from '../geometry/cell.ts'
import type { PacketShape } from '../packets/packet.ts'
import {
  defaultSlotBracketStyle,
  Machine,
  type SlotBracketStyle,
} from './machine.ts'
import { Slot } from './slot.ts'

/** Fixed emitter with a single output slot on the neighboring cell. */
export class SourceMachine extends Machine {
  readonly kind = 'source'
  static readonly size = 3
  /** How far the output “[” back edge overlaps into the circular body (percent of one cell). */
  static readonly outputBracketInsetPercent = 45
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

  /**
   * Output brackets extend their back edge into the 3×3 footprint so the port
   * meets the inscribed circle with no visible gap (presentation only).
   */
  override slotBracket(
    slot: Slot,
    cellPx: number,
    style: SlotBracketStyle = defaultSlotBracketStyle,
  ): { x: number; y: number }[] {
    const path = super.slotBracket(slot, cellPx, style)
    if (slot.role !== 'output') return path
    const inset = (SourceMachine.outputBracketInsetPercent / 100) * cellPx
    const open = slot.travel
    const left = slot.cell.x * cellPx
    const top = slot.cell.y * cellPx
    const right = left + cellPx
    const bottom = top + cellPx
    const eps = 0.001
    const onBack = (x: number, y: number) => {
      if (open === 'east') return Math.abs(x - left) < eps
      if (open === 'west') return Math.abs(x - right) < eps
      if (open === 'north') return Math.abs(y - bottom) < eps
      return Math.abs(y - top) < eps
    }
    const shift = (x: number, y: number) => {
      if (open === 'east') return { x: x - inset, y }
      if (open === 'west') return { x: x + inset, y }
      if (open === 'north') return { x, y: y + inset }
      return { x, y: y - inset }
    }
    return path.map((point) => (onBack(point.x, point.y) ? shift(point.x, point.y) : point))
  }
}

function faceCenter(direction: Direction): Cell {
  const mid = Math.floor(SourceMachine.size / 2)
  if (direction === 'east') return { x: SourceMachine.size - 1, y: mid }
  if (direction === 'west') return { x: 0, y: mid }
  if (direction === 'south') return { x: mid, y: SourceMachine.size - 1 }
  return { x: mid, y: 0 }
}
