import type { Cell } from '../../geometry/cell.ts'
import type { Direction } from '../../geometry/direction.ts'
import {
  clearanceDepths,
  freeRect,
  portCountsBySide,
  rectsOverlap,
  type FreeRect,
  type SideDepths,
} from '../../geometry/clearance.ts'
import { CoreMachine } from '../../machines/core-machine.ts'
import { SourceMachine } from '../../machines/source-machine.ts'
import type { PipelineRules } from '../../rules.ts'
import type { OccupiedMachine } from '../types.ts'

/** Clearance field for machine placement within a bounded grid. */
export class PlacementField {
  readonly rules: PipelineRules
  readonly width: number
  readonly height: number
  private occupiedFreeRects: FreeRect[]

  constructor(
    rules: PipelineRules,
    width: number,
    height: number,
    occupied: OccupiedMachine[] = [],
  ) {
    this.rules = rules
    this.width = width
    this.height = height
    this.occupiedFreeRects = occupied.flatMap((machine) => this.freeRectsForOccupied(machine))
  }

  addOccupied(machine: OccupiedMachine): void {
    this.occupiedFreeRects.push(...this.freeRectsForOccupied(machine))
  }

  sourceDepthsFor(direction: Direction): SideDepths {
    const probe = new SourceMachine(
      'source',
      { x: 0, y: 0 },
      direction,
      'circle',
      this.rules.sourcePeriodTicks,
    )
    return clearanceDepths(portCountsBySide(probe), this.rules.machineClearanceMin)
  }

  coreDepthsAt(coreOrigin: Cell): SideDepths {
    const core = new CoreMachine('core', coreOrigin)
    return clearanceDepths(
      portCountsBySide(core),
      this.rules.machineClearanceMin,
      this.rules.coreClearanceExtra,
    )
  }

  freeRectForCore(coreOrigin: Cell): FreeRect {
    const core = new CoreMachine('core', coreOrigin)
    const depths = this.coreDepthsAt(coreOrigin)
    return freeRect(core.origin, core.width, core.height, depths)
  }

  freeRectForSource(source: SourceMachine): FreeRect {
    const depths = clearanceDepths(portCountsBySide(source), this.rules.machineClearanceMin)
    return freeRect(source.origin, source.width, source.height, depths)
  }

  footprintInBounds(machine: CoreMachine | SourceMachine): boolean {
    const { x, y } = machine.origin
    const right = x + machine.width - 1
    const bottom = y + machine.height - 1
    return x >= 0 && y >= 0 && right < this.width && bottom < this.height
  }

  overlapsOccupied(rect: FreeRect): boolean {
    return this.occupiedFreeRects.some((occupied) => rectsOverlap(occupied, rect))
  }

  sourceOverlapsOccupied(source: SourceMachine): boolean {
    return this.overlapsOccupied(this.freeRectForSource(source))
  }

  private freeRectsForOccupied(machine: OccupiedMachine): FreeRect[] {
    if (machine.kind === 'core') {
      return [this.freeRectForCore(machine.origin)]
    }
    const source = new SourceMachine(
      's',
      machine.origin,
      machine.direction,
      'circle',
      this.rules.sourcePeriodTicks,
    )
    return [this.freeRectForSource(source)]
  }
}