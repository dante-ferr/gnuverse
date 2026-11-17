import type { Cell } from '../geometry/cell.ts'
import type { Direction } from '../geometry/direction.ts'
import {
  clearanceDepths,
  freeRect,
  portCountsBySide,
  rectsOverlap,
  type SideDepths,
} from '../geometry/clearance.ts'
import { createSeedRng } from '../geometry/seed-rng.ts'
import { CoreMachine } from '../machines/core-machine.ts'
import { SourceMachine } from '../machines/source-machine.ts'
import type { PipelineRules } from '../rules.ts'

type LayoutCandidate = {
  sourceOrigin: Cell
  sourceDirection: Direction
}

export function layoutInitialMachines(
  rules: PipelineRules,
  seed: string,
): {
  coreOrigin: Cell
  sourceOrigin: Cell
  sourceDirection: Direction
} {
  const coreOrigin = {
    x: Math.floor((rules.gridWidth - CoreMachine.size) / 2),
    y: Math.floor((rules.gridHeight - CoreMachine.size) / 2),
  }

  const probeCore = new CoreMachine('core', coreOrigin)
  const coreDepths = clearanceDepths(
    portCountsBySide(probeCore),
    rules.machineClearanceMin,
    rules.coreClearanceExtra,
  )

  const candidates = collectLayoutCandidates(rules, coreOrigin, coreDepths)
  if (candidates.length === 0)
    throw new Error(
      `Grid ${rules.gridWidth}×${rules.gridHeight} is too small for core and source with clearance margins`,
    )

  const rng = createSeedRng(seed)
  const chosen = candidates[Math.floor(rng() * candidates.length)]!

  return {
    coreOrigin,
    sourceOrigin: chosen.sourceOrigin,
    sourceDirection: chosen.sourceDirection,
  }
}

function collectLayoutCandidates(
  rules: PipelineRules,
  coreOrigin: Cell,
  coreDepths: SideDepths,
): LayoutCandidate[] {
  const out: LayoutCandidate[] = []

  const addEast = sourceDepthsFor(rules, 'east')
  const xWest =
    coreOrigin.x - SourceMachine.size - addEast.east - coreDepths.west
  for (let y = 0; y <= rules.gridHeight - SourceMachine.size; y++)
    tryCandidate(rules, coreOrigin, coreDepths, 'east', { x: xWest, y }, out)

  const addWest = sourceDepthsFor(rules, 'west')
  const xEast =
    coreOrigin.x + CoreMachine.size + addWest.west + coreDepths.east
  for (let y = 0; y <= rules.gridHeight - SourceMachine.size; y++)
    tryCandidate(rules, coreOrigin, coreDepths, 'west', { x: xEast, y }, out)

  const addSouth = sourceDepthsFor(rules, 'south')
  const yNorth =
    coreOrigin.y - SourceMachine.size - addSouth.south - coreDepths.north
  for (let x = 0; x <= rules.gridWidth - SourceMachine.size; x++)
    tryCandidate(rules, coreOrigin, coreDepths, 'south', { x, y: yNorth }, out)

  const addNorth = sourceDepthsFor(rules, 'north')
  const ySouth =
    coreOrigin.y + CoreMachine.size + addNorth.north + coreDepths.south
  for (let x = 0; x <= rules.gridWidth - SourceMachine.size; x++)
    tryCandidate(rules, coreOrigin, coreDepths, 'north', { x, y: ySouth }, out)

  return out
}

function sourceDepthsFor(rules: PipelineRules, direction: Direction): SideDepths {
  const probe = new SourceMachine(
    'source',
    { x: 0, y: 0 },
    direction,
    'circle',
    rules.sourcePeriodTicks,
  )
  return clearanceDepths(portCountsBySide(probe), rules.machineClearanceMin)
}

function tryCandidate(
  rules: PipelineRules,
  coreOrigin: Cell,
  coreDepths: SideDepths,
  sourceDirection: Direction,
  sourceOrigin: Cell,
  out: LayoutCandidate[],
) {
  const sourceDepths = sourceDepthsFor(rules, sourceDirection)
  const core = new CoreMachine('core', coreOrigin)
  const source = new SourceMachine(
    'source',
    sourceOrigin,
    sourceDirection,
    'circle',
    rules.sourcePeriodTicks,
  )

  if (!footprintInBounds(core, rules.gridWidth, rules.gridHeight)) return
  if (!footprintInBounds(source, rules.gridWidth, rules.gridHeight)) return

  const coreFree = freeRect(core.origin, core.width, core.height, coreDepths)
  const sourceFree = freeRect(source.origin, source.width, source.height, sourceDepths)
  if (rectsOverlap(coreFree, sourceFree)) return

  out.push({ sourceOrigin, sourceDirection })
}

function footprintInBounds(
  machine: CoreMachine | SourceMachine,
  width: number,
  height: number,
): boolean {
  const { x, y } = machine.origin
  const right = x + machine.width - 1
  const bottom = y + machine.height - 1
  return x >= 0 && y >= 0 && right < width && bottom < height
}

/** Body-to-body gap along the approach axis (clearance band between footprints). */
export function bodyGapAlongApproach(
  coreOrigin: Cell,
  sourceOrigin: Cell,
  sourceDirection: Direction,
  sourceDepths: SideDepths,
  coreDepths: SideDepths,
): number {
  if (sourceDirection === 'east') {
    const gap = coreOrigin.x - (sourceOrigin.x + SourceMachine.size)
    return gap
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