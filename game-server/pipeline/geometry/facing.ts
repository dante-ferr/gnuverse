import type { Cell } from './cell.ts'
import type { Direction } from './direction.ts'

const TURN_ORDER: readonly Direction[] = ['east', 'south', 'west', 'north']

function quarterTurns(facing: Direction): number {
  if (facing === 'east') return 0
  if (facing === 'south') return 1
  if (facing === 'west') return 2
  return 3
}

/** Rotate a local footprint cell from east-facing layout into `facing`. */
export function rotateLocalCell(
  lx: number,
  ly: number,
  width: number,
  height: number,
  facing: Direction,
): Cell {
  const cx = (width - 1) / 2
  const cy = (height - 1) / 2
  let dx = lx - cx
  let dy = ly - cy
  const turns = quarterTurns(facing)
  for (let i = 0; i < turns; i++) {
    const ndx = dy
    const ndy = -dx
    dx = ndx
    dy = ndy
  }
  return {
    x: Math.round(cx + dx),
    y: Math.round(cy + dy),
  }
}

/** Rotate a travel direction from east-facing layout into `facing`. */
export function rotateTravel(travel: Direction, facing: Direction): Direction {
  const from = TURN_ORDER.indexOf(travel)
  const turns = quarterTurns(facing)
  return TURN_ORDER[(from + turns) % 4]!
}