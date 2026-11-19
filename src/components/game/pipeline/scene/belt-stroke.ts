import type { Direction } from '../model/frame.ts'
import { directionBetween, orthogonalPath, projectStraightEnd } from './grid-math.ts'

export type StrokeCell = { x: number; y: number; direction: Direction }

/** Builds a straight horizontal or vertical conveyor stroke from a pointer drag. */
export class BeltStroke {
  readonly cells: StrokeCell[] = []
  private origin: { x: number; y: number } | null = null

  /** Returns true when the stroke cells change. */
  push(cell: { x: number; y: number }): boolean {
    if (!this.origin) {
      this.origin = { x: cell.x, y: cell.y }
      this.cells.length = 0
      this.cells.push({ x: cell.x, y: cell.y, direction: 'east' })
      return true
    }
    return this.rebuild(projectStraightEnd(this.origin, cell))
  }

  private rebuild(end: { x: number; y: number }): boolean {
    const origin = this.origin
    if (!origin) return false
    const next: StrokeCell[] = []
    if (end.x === origin.x && end.y === origin.y) {
      next.push({ x: origin.x, y: origin.y, direction: 'east' })
    } else {
      const steps = orthogonalPath(origin, end)
      const first = steps[0]
      if (!first) return false
      const direction = directionBetween(origin, first)
      if (!direction) return false
      next.push({ x: origin.x, y: origin.y, direction })
      for (const step of steps) {
        next.push({ x: step.x, y: step.y, direction })
      }
    }
    if (sameStroke(this.cells, next)) return false
    this.cells.length = 0
    this.cells.push(...next)
    return true
  }
}

function sameStroke(a: StrokeCell[], b: StrokeCell[]) {
  if (a.length !== b.length) return false
  return a.every((cell, index) => {
    const other = b[index]
    return other && cell.x === other.x && cell.y === other.y && cell.direction === other.direction
  })
}
