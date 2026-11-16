import type { Direction } from '../model/frame.ts'
import { directionBetween } from './grid-math.ts'

export type StrokeCell = { x: number; y: number; direction: Direction }

/** Builds a conveyor stroke from a pointer drag. */
export class BeltStroke {
  readonly cells: StrokeCell[] = []

  push(cell: { x: number; y: number }) {
    const last = this.cells[this.cells.length - 1]
    if (!last) {
      this.cells.push({ ...cell, direction: 'east' })
      return
    }
    if (last.x === cell.x && last.y === cell.y) return
    const direction = directionBetween(last, cell)
    if (!direction) return
    last.direction = direction
    this.cells.push({ ...cell, direction })
  }
}
