import { getBeltPlaceDirection } from '../belt-place-options.ts'
import type { Direction } from '../model/frame.ts'
import { directionBetween, manhattanElbow } from './grid-math.ts'

export type StrokeCell = { x: number; y: number; direction: Direction }

/** Builds a straight or L-shaped conveyor stroke from a pointer drag. */
export class BeltStroke {
  readonly cells: StrokeCell[] = []
  private origin: { x: number; y: number } | null = null
  /** Facing used for the origin cell before the pointer leaves it. */
  private readonly seedDirection: Direction | null

  constructor(seedDirection?: Direction) {
    this.seedDirection = seedDirection ?? null
  }

  private idleDirection(fallback: Direction | null = null) {
    return fallback ?? this.seedDirection ?? getBeltPlaceDirection()
  }

  /** Returns true when the stroke cells change. */
  push(cell: { x: number; y: number }): boolean {
    if (!this.origin) {
      this.origin = { x: cell.x, y: cell.y }
      this.cells.length = 0
      this.cells.push({ x: cell.x, y: cell.y, direction: this.idleDirection() })
      return true
    }
    return this.rebuild(cell)
  }

  private rebuild(end: { x: number; y: number }): boolean {
    const origin = this.origin
    if (!origin) return false
    const next: StrokeCell[] = []
    if (end.x === origin.x && end.y === origin.y) {
      // Keep the facing chosen while the path was extended (or the seed).
      next.push({
        x: origin.x,
        y: origin.y,
        direction: this.idleDirection(this.cells[0]?.direction ?? null),
      })
    } else {
      const steps = manhattanElbow(origin, end)
      const path = [origin, ...steps]
      for (let i = 0; i < path.length; i++) {
        const cell = path[i]!
        const following = path[i + 1]
        const previous = path[i - 1]
        const direction = following
          ? directionBetween(cell, following)
          : previous
            ? directionBetween(previous, cell)
            : null
        if (!direction) return false
        next.push({ x: cell.x, y: cell.y, direction })
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
