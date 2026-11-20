import type { Direction } from './model/frame.ts'
import { getBeltPlaceDirection } from './belt-place-options.ts'
import { ahead } from './scene/grid-math.ts'

/** Neighbor sides in top → right → bottom → left order. */
const INBOUND_PRIORITY: readonly Direction[] = ['north', 'east', 'south', 'west']

type BeltLike = { x: number; y: number; direction: Direction }

function opposite(direction: Direction): Direction {
  if (direction === 'north') return 'south'
  if (direction === 'south') return 'north'
  if (direction === 'east') return 'west'
  return 'east'
}

/**
 * Facing copied from an adjacent belt that points into `cell`.
 * Returns null when none or more than one feeder exists (no adjacency influence).
 */
export function directionFromInboundBelts(
  cell: { x: number; y: number },
  belts: readonly BeltLike[],
): Direction | null {
  const byKey = new Map(belts.map((belt) => [`${belt.x},${belt.y}`, belt]))
  const inbound: Direction[] = []
  for (const side of INBOUND_PRIORITY) {
    const neighbor = ahead(cell.x, cell.y, side)
    const belt = byKey.get(`${neighbor.x},${neighbor.y}`)
    if (belt && belt.direction === opposite(side)) inbound.push(belt.direction)
  }
  if (inbound.length !== 1) return null
  return inbound[0]!
}

/** Inbound continuation when present; otherwise the Girar / R place facing. */
export function resolveBeltPlaceDirection(
  cell: { x: number; y: number },
  belts: readonly BeltLike[],
): Direction {
  return directionFromInboundBelts(cell, belts) ?? getBeltPlaceDirection()
}
