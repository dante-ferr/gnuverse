import type { Cell } from '../geometry/cell.ts'
import { sameCell } from '../geometry/cell.ts'
import { Slot } from './slot.ts'

/** A structure with a footprint and named input or output slots. */
export abstract class Machine {
  readonly slots: Slot[] = []
  readonly id: string
  readonly origin: Cell
  readonly width: number
  readonly height: number

  constructor(id: string, origin: Cell, width: number, height: number) {
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

  protected addSlot(slot: Slot) {
    this.slots.push(slot)
  }
}
