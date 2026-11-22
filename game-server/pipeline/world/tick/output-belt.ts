import { cellKey } from '../../geometry/cell.ts'
import { opposite, type Direction } from '../../geometry/direction.ts'
import type { Match } from '../match.ts'

/**
 * True when `cell` has an empty belt that is not facing back into the output
 * port. Outward and perpendicular belts are allowed; inward-only is rejected.
 */
export function outputBeltAccepts(
  match: Match,
  cell: { x: number; y: number },
  travel: Direction,
) {
  if (!match.inBounds(cell)) return false
  const belt = match.beltAt(cell)
  if (!belt || belt.direction === opposite(travel)) return false
  return !match.packets.some((packet) => cellKey(packet.cell) === cellKey(cell))
}
