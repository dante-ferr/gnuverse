import type { Cell } from '../geometry/cell.ts'
import type { Direction } from '../geometry/direction.ts'

/** A cell where a machine accepts or emits a packet. */
export class Slot {
  readonly id: string
  readonly role: 'input' | 'output'
  readonly cell: Cell
  readonly travel: Direction

  constructor(id: string, role: 'input' | 'output', cell: Cell, travel: Direction) {
    this.id = id
    this.role = role
    this.cell = cell
    this.travel = travel
  }
}
