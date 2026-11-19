import type { Direction } from '../model/frame.ts'

export function ahead(x: number, y: number, direction: Direction) {
  if (direction === 'north') return { x, y: y - 1 }
  if (direction === 'south') return { x, y: y + 1 }
  if (direction === 'east') return { x: x + 1, y }
  return { x: x - 1, y }
}

export function directionBetween(
  from: { x: number; y: number },
  to: { x: number; y: number },
): Direction | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null
  if (dx === 1) return 'east'
  if (dx === -1) return 'west'
  if (dy === 1) return 'south'
  return 'north'
}

/**
 * Orthogonal cells from `from` (exclusive) to `to` (inclusive).
 * Fills gaps when a pointer jump skips cells; staircases on diagonals.
 */
export function orthogonalPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = []
  let x = from.x
  let y = from.y
  while (x !== to.x || y !== to.y) {
    const dx = to.x - x
    const dy = to.y - y
    if (dx !== 0 && (dy === 0 || Math.abs(dx) >= Math.abs(dy))) {
      x += dx > 0 ? 1 : -1
    } else if (dy !== 0) {
      y += dy > 0 ? 1 : -1
    } else {
      break
    }
    cells.push({ x, y })
  }
  return cells
}

/** Snap `to` onto a horizontal or vertical line through `from` (dominant axis). */
export function projectStraightEnd(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return { x: from.x, y: from.y }
  if (Math.abs(dx) >= Math.abs(dy)) return { x: to.x, y: from.y }
  return { x: from.x, y: to.y }
}
