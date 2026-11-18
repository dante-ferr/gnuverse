import { ahead, directions, opposite } from '../../geometry/direction.ts'
import type { BeltMachine } from '../../machines/belt-machine.ts'
import type { Match } from '../match.ts'

/** A belt cell accepts at most this many inbound feeders. */
export const MERGE_INPUT_MAX = 3

/** Belts that push into `cell`, stable NESW order. */
export function allInboundBelts(match: Match, cell: { x: number; y: number }): BeltMachine[] {
  const found: BeltMachine[] = []
  for (const dir of directions) {
    const neighbor = ahead(cell.x, cell.y, dir)
    const belt = match.beltAt(neighbor)
    if (belt && belt.direction === opposite(dir)) found.push(belt)
  }
  return found
}

/** Inbound feeders that participate in merge arbitration (NESW, capped). */
export function mergeInputs(match: Match, cell: { x: number; y: number }): BeltMachine[] {
  return allInboundBelts(match, cell).slice(0, MERGE_INPUT_MAX)
}