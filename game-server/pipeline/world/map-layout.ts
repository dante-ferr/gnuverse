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

export type SourceRole = 'fire' | 'water' | 'circle'

export type PlacedSource = {
  id: string
  origin: Cell
  direction: Direction
  shape: 'circle'
  role: SourceRole
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

  const candidates = collectLayoutCandidates(
    rules,
    coreOrigin,
    coreDepths,
    rules.gridWidth,
    rules.gridHeight,
  )
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

export function collectLayoutCandidates(
  rules: PipelineRules,
  coreOrigin: Cell,
  coreDepths: SideDepths,
  gridWidth: number,
  gridHeight: number,
): LayoutCandidate[] {
  const out: LayoutCandidate[] = []

  const addEast = sourceDepthsFor(rules, 'east')
  const xWest =
    coreOrigin.x - SourceMachine.size - addEast.east - coreDepths.west
  for (let y = 0; y <= gridHeight - SourceMachine.size; y++)
    tryCandidate(rules, coreOrigin, coreDepths, 'east', { x: xWest, y }, out, gridWidth, gridHeight)

  const addWest = sourceDepthsFor(rules, 'west')
  const xEast =
    coreOrigin.x + CoreMachine.size + addWest.west + coreDepths.east
  for (let y = 0; y <= gridHeight - SourceMachine.size; y++)
    tryCandidate(rules, coreOrigin, coreDepths, 'west', { x: xEast, y }, out, gridWidth, gridHeight)

  const addSouth = sourceDepthsFor(rules, 'south')
  const yNorth =
    coreOrigin.y - SourceMachine.size - addSouth.south - coreDepths.north
  for (let x = 0; x <= gridWidth - SourceMachine.size; x++)
    tryCandidate(rules, coreOrigin, coreDepths, 'south', { x, y: yNorth }, out, gridWidth, gridHeight)

  const addNorth = sourceDepthsFor(rules, 'north')
  const ySouth =
    coreOrigin.y + CoreMachine.size + addNorth.north + coreDepths.south
  for (let x = 0; x <= gridWidth - SourceMachine.size; x++)
    tryCandidate(rules, coreOrigin, coreDepths, 'north', { x, y: ySouth }, out, gridWidth, gridHeight)

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
  gridWidth: number,
  gridHeight: number,
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

  if (!footprintInBounds(core, gridWidth, gridHeight)) return
  if (!footprintInBounds(source, gridWidth, gridHeight)) return

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

/** Two clearance-separated circle sources around a core within a square field. */
export function layoutTwoStarterSources(
  rules: PipelineRules,
  seed: string,
  coreOrigin: Cell,
  fieldSize: number,
): [PlacedSource, PlacedSource] {
  const probeCore = new CoreMachine('core', coreOrigin)
  const coreDepths = clearanceDepths(
    portCountsBySide(probeCore),
    rules.machineClearanceMin,
    rules.coreClearanceExtra,
  )
  const candidates = collectLayoutCandidates(rules, coreOrigin, coreDepths, fieldSize, fieldSize)
  if (candidates.length < 2)
    throw new Error(
      `Field ${fieldSize}×${fieldSize} is too small for core and two sources with clearance margins`,
    )

  const rng = createSeedRng(seed)
  const order = [...candidates]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }

  for (let a = 0; a < order.length; a++) {
    const first = order[a]!
    const sourceA = new SourceMachine(
      'source-a',
      first.sourceOrigin,
      first.sourceDirection,
      'circle',
      rules.sourcePeriodTicks,
    )
    const sourceADepths = clearanceDepths(portCountsBySide(sourceA), rules.machineClearanceMin)
    const sourceAFree = freeRect(sourceA.origin, sourceA.width, sourceA.height, sourceADepths)

    for (let b = a + 1; b < order.length; b++) {
      const second = order[b]!
      const sourceB = new SourceMachine(
        'source-b',
        second.sourceOrigin,
        second.sourceDirection,
        'circle',
        rules.sourcePeriodTicks,
      )
      const sourceBDepths = clearanceDepths(portCountsBySide(sourceB), rules.machineClearanceMin)
      const sourceBFree = freeRect(sourceB.origin, sourceB.width, sourceB.height, sourceBDepths)
      if (rectsOverlap(sourceAFree, sourceBFree)) continue

      return [
        {
          id: 'source-fire',
          origin: first.sourceOrigin,
          direction: first.sourceDirection,
          shape: 'circle',
          role: 'fire',
        },
        {
          id: 'source-water',
          origin: second.sourceOrigin,
          direction: second.sourceDirection,
          shape: 'circle',
          role: 'water',
        },
      ]
    }
  }

  throw new Error(
    `Field ${fieldSize}×${fieldSize} has no pair of source placements with clearance around the core`,
  )
}

/** Try one circle source inside a chunk local rect; returns null when clearance fails. */
export type OccupiedMachine =
  | { kind: 'core'; origin: Cell }
  | { kind: 'source'; origin: Cell; direction: Direction }

export function tryPlaceCircleSourceInChunk(
  rules: PipelineRules,
  subSeed: string,
  chunkOrigin: Cell,
  chunkSize: number,
  occupied: OccupiedMachine[],
): PlacedSource | null {
  const rng = createSeedRng(subSeed)
  const dirs: Direction[] = ['north', 'east', 'south', 'west']
  const trials: { x: number; y: number; direction: Direction }[] = []
  for (const direction of dirs) {
    for (let y = 0; y <= chunkSize - SourceMachine.size; y++) {
      for (let x = 0; x <= chunkSize - SourceMachine.size; x++) {
        trials.push({ x: chunkOrigin.x + x, y: chunkOrigin.y + y, direction })
      }
    }
  }
  for (let i = trials.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[trials[i], trials[j]] = [trials[j]!, trials[i]!]
  }

  const freeRects = occupiedFreeRects(rules, occupied)

  for (const trial of trials) {
    const source = new SourceMachine(
      'probe',
      { x: trial.x, y: trial.y },
      trial.direction,
      'circle',
      rules.sourcePeriodTicks,
    )
    if (source.origin.x < chunkOrigin.x || source.origin.y < chunkOrigin.y) continue
    const right = source.origin.x + source.width - 1
    const bottom = source.origin.y + source.height - 1
    if (right >= chunkOrigin.x + chunkSize || bottom >= chunkOrigin.y + chunkSize) continue

    const sourceDepths = clearanceDepths(portCountsBySide(source), rules.machineClearanceMin)
    const sourceFree = freeRect(source.origin, source.width, source.height, sourceDepths)
    if (freeRects.some((rect) => rectsOverlap(rect, sourceFree))) continue

    const id = `source-${trial.x}-${trial.y}`
    return {
      id,
      origin: source.origin,
      direction: source.direction,
      shape: 'circle',
      role: 'circle',
    }
  }
  return null
}

function occupiedFreeRects(rules: PipelineRules, occupied: OccupiedMachine[]) {
  const rects = []
  for (const machine of occupied) {
    if (machine.kind === 'core') {
      const core = new CoreMachine('core', machine.origin)
      const depths = clearanceDepths(
        portCountsBySide(core),
        rules.machineClearanceMin,
        rules.coreClearanceExtra,
      )
      rects.push(freeRect(core.origin, core.width, core.height, depths))
    } else {
      const source = new SourceMachine(
        's',
        machine.origin,
        machine.direction,
        'circle',
        rules.sourcePeriodTicks,
      )
      const depths = clearanceDepths(portCountsBySide(source), rules.machineClearanceMin)
      rects.push(freeRect(source.origin, source.width, source.height, depths))
    }
  }
  return rects
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