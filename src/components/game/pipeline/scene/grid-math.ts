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
