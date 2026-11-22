import type { Cell } from '../../geometry/cell.ts'
import type { Direction } from '../../geometry/direction.ts'
import type { SideDepths } from '../../geometry/clearance.ts'
import { CoreMachine } from '../../machines/core-machine.ts'
import { SourceMachine } from '../../machines/source-machine.ts'

/** Body-to-body gap along the approach axis (clearance band between footprints). */
export function bodyGapAlongApproach(
  coreOrigin: Cell,
  sourceOrigin: Cell,
  sourceDirection: Direction,
  sourceDepths: SideDepths,
  coreDepths: SideDepths,
): number {
  if (sourceDirection === 'east') {
    return coreOrigin.x - (sourceOrigin.x + SourceMachine.size)
  }
  if (sourceDirection === 'west') {
    return sourceOrigin.x - (coreOrigin.x + CoreMachine.size)
  }
  if (sourceDirection === 'south') {
    return coreOrigin.y - (sourceOrigin.y + SourceMachine.size)
  }
  return sourceOrigin.y - (coreOrigin.y + CoreMachine.size)
}

export function expectedBodyGap(
  sourceDirection: Direction,
  sourceDepths: SideDepths,
  coreDepths: SideDepths,
): number {
  if (sourceDirection === 'east') return sourceDepths.east + coreDepths.west
  if (sourceDirection === 'west') return sourceDepths.west + coreDepths.east
  if (sourceDirection === 'south') return sourceDepths.south + coreDepths.north
  return sourceDepths.north + coreDepths.south
}