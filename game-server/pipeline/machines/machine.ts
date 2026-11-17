import type { Cell } from '../geometry/cell.ts'
import { sameCell } from '../geometry/cell.ts'
import { ahead, opposite, type Direction } from '../geometry/direction.ts'
import { Slot } from './slot.ts'

/** A structure with a footprint and named input or output slots. */
export abstract class Machine {
  readonly slots: Slot[] = []
  readonly id: string
  readonly origin: Cell
  readonly width: number
  readonly height: number

  constructor(id: string, origin: Cell, width: number, height: number) {
    if (!Number.isInteger(width) || width <= 0)
      throw new Error(`Machine width must be a positive integer, got ${width}`)
    if (!Number.isInteger(height) || height <= 0)
      throw new Error(`Machine height must be a positive integer, got ${height}`)
    this.id = id
    this.origin = origin
    this.width = width
    this.height = height
  }

  abstract readonly kind: string

  covers(cell: Cell) {
    return (
      cell.x >= this.origin.x &&
      cell.x < this.origin.x + this.width &&
      cell.y >= this.origin.y &&
      cell.y < this.origin.y + this.height
    )
  }

  inputSlots() {
    return this.slots.filter((slot) => slot.role === 'input')
  }

  outputSlots() {
    return this.slots.filter((slot) => slot.role === 'output')
  }

  slotAt(cell: Cell, role: Slot['role']) {
    return this.slots.find((slot) => slot.role === role && sameCell(slot.cell, cell))
  }

  /**
   * Closed “[”-shaped polygon in world pixels.
   * Opens outward (inputs: opposite travel; outputs: travel).
   * Spans one cell; may protrude past the machine body.
   */
  slotBracket(slot: Slot, cellPx: number): { x: number; y: number }[] {
    const depth = 0.28 * cellPx
    const thick = 0.18 * cellPx
    const open: Direction = slot.role === 'input' ? opposite(slot.travel) : slot.travel
    const left = slot.cell.x * cellPx
    const top = slot.cell.y * cellPx
    const right = left + cellPx
    const bottom = top + cellPx
    // Inputs: back on the outer rim of the footprint cell.
    // Outputs: back on the shared edge with the machine (inner side of the exterior cell).
    const fromOutside = slot.role === 'output'

    if (open === 'east') {
      const back = fromOutside ? left : right
      const tip = back + depth
      const spine = back + thick
      return [
        { x: back, y: top },
        { x: tip, y: top },
        { x: tip, y: top + thick },
        { x: spine, y: top + thick },
        { x: spine, y: bottom - thick },
        { x: tip, y: bottom - thick },
        { x: tip, y: bottom },
        { x: back, y: bottom },
      ]
    }
    if (open === 'west') {
      const back = fromOutside ? right : left
      const tip = back - depth
      const spine = back - thick
      return [
        { x: back, y: top },
        { x: tip, y: top },
        { x: tip, y: top + thick },
        { x: spine, y: top + thick },
        { x: spine, y: bottom - thick },
        { x: tip, y: bottom - thick },
        { x: tip, y: bottom },
        { x: back, y: bottom },
      ]
    }
    if (open === 'north') {
      const back = fromOutside ? bottom : top
      const tip = back - depth
      const spine = back - thick
      return [
        { x: left, y: back },
        { x: left, y: tip },
        { x: left + thick, y: tip },
        { x: left + thick, y: spine },
        { x: right - thick, y: spine },
        { x: right - thick, y: tip },
        { x: right, y: tip },
        { x: right, y: back },
      ]
    }
    const back = fromOutside ? top : bottom
    const tip = back + depth
    const spine = back + thick
    return [
      { x: left, y: back },
      { x: left, y: tip },
      { x: left + thick, y: tip },
      { x: left + thick, y: spine },
      { x: right - thick, y: spine },
      { x: right - thick, y: tip },
      { x: right, y: tip },
      { x: right, y: back },
    ]
  }

  protected addSlot(slot: Slot) {
    if (slot.role === 'input') this.validateInputSlot(slot)
    else this.validateOutputSlot(slot)
    this.slots.push(slot)
  }

  private onRim(cell: Cell) {
    return (
      cell.x === this.origin.x ||
      cell.x === this.origin.x + this.width - 1 ||
      cell.y === this.origin.y ||
      cell.y === this.origin.y + this.height - 1
    )
  }

  private validateInputSlot(slot: Slot) {
    if (!this.covers(slot.cell))
      throw new Error(
        `Input slot ${slot.id} must sit on the machine footprint, got (${slot.cell.x}, ${slot.cell.y})`,
      )
    if (!this.onRim(slot.cell))
      throw new Error(
        `Input slot ${slot.id} must be on the outer rim of the footprint, got (${slot.cell.x}, ${slot.cell.y})`,
      )
    const outside = ahead(slot.cell.x, slot.cell.y, opposite(slot.travel))
    if (this.covers(outside))
      throw new Error(
        `Input slot ${slot.id} must open outward: cell (${outside.x}, ${outside.y}) opposite travel must be outside the footprint`,
      )
  }

  private validateOutputSlot(slot: Slot) {
    if (this.covers(slot.cell))
      throw new Error(
        `Output slot ${slot.id} must lie outside the footprint, got (${slot.cell.x}, ${slot.cell.y})`,
      )
    const rim = ahead(slot.cell.x, slot.cell.y, opposite(slot.travel))
    if (!this.covers(rim))
      throw new Error(
        `Output slot ${slot.id} must attach to the rim: cell (${rim.x}, ${rim.y}) opposite travel must be on the footprint`,
      )
    const aheadCell = ahead(rim.x, rim.y, slot.travel)
    if (!sameCell(aheadCell, slot.cell))
      throw new Error(
        `Output slot ${slot.id} must be exactly one cell outside along travel from the rim attachment (${rim.x}, ${rim.y})`,
      )
  }
}
