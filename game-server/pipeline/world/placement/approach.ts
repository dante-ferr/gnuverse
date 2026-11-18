import type { Cell } from '../../geometry/cell.ts'
import type { Direction } from '../../geometry/direction.ts'
import type { SideDepths } from '../../geometry/clearance.ts'
import { createSeedRng } from '../../geometry/seed-rng.ts'
import { CoreMachine } from '../../machines/core-machine.ts'
import { SourceMachine } from '../../machines/source-machine.ts'
import type { PipelineRules } from '../../rules.ts'
import type { PlacedSource } from '../types.ts'
import { PlacementField } from './field.ts'

type LayoutCandidate = {
  sourceOrigin: Cell
  sourceDirection: Direction
}

export function collectLayoutCandidates(
  rules: PipelineRules,
  coreOrigin: Cell,
  coreDepths: SideDepths,
  gridWidth: number,
  gridHeight: number,
): LayoutCandidate[] {
  const field = new PlacementField(rules, gridWidth, gridHeight, [
    { kind: 'core', origin: coreOrigin },
  ])
  const out: LayoutCandidate[] = []

  const addEast = field.sourceDepthsFor('east')
  const xWest = coreOrigin.x - SourceMachine.size - addEast.east - coreDepths.west
  for (let y = 0; y <= gridHeight - SourceMachine.size; y++)
    tryCandidate(field, 'east', { x: xWest, y }, out)

  const addWest = field.sourceDepthsFor('west')
  const xEast = coreOrigin.x + CoreMachine.size + addWest.west + coreDepths.east
  for (let y = 0; y <= gridHeight - SourceMachine.size; y++)
    tryCandidate(field, 'west', { x: xEast, y }, out)

  const addSouth = field.sourceDepthsFor('south')
  const yNorth = coreOrigin.y - SourceMachine.size - addSouth.south - coreDepths.north
  for (let x = 0; x <= gridWidth - SourceMachine.size; x++)
    tryCandidate(field, 'south', { x, y: yNorth }, out)

  const addNorth = field.sourceDepthsFor('north')
  const ySouth = coreOrigin.y + CoreMachine.size + addNorth.north + coreDepths.south
  for (let x = 0; x <= gridWidth - SourceMachine.size; x++)
    tryCandidate(field, 'north', { x, y: ySouth }, out)

  return out
}

function tryCandidate(
  field: PlacementField,
  sourceDirection: Direction,
  sourceOrigin: Cell,
  out: LayoutCandidate[],
) {
  const source = new SourceMachine(
    'source',
    sourceOrigin,
    sourceDirection,
    'circle',
    field.rules.sourcePeriodTicks,
  )

  if (!field.footprintInBounds(source)) return
  if (field.sourceOverlapsOccupied(source)) return

  out.push({ sourceOrigin, sourceDirection })
}

/** Two clearance-separated circle sources around a core within a square field. */
export function layoutTwoStarterSources(
  rules: PipelineRules,
  seed: string,
  coreOrigin: Cell,
  fieldSize: number,
): [PlacedSource, PlacedSource] {
  const field = new PlacementField(rules, fieldSize, fieldSize, [
    { kind: 'core', origin: coreOrigin },
  ])
  if (!field.footprintInBounds(new CoreMachine('core', coreOrigin)))
    throw new Error(`Field ${fieldSize}×${fieldSize} cannot fit the core at (${coreOrigin.x}, ${coreOrigin.y})`)

  const coreDepths = field.coreDepthsAt(coreOrigin)
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
    const withFirst = new PlacementField(rules, fieldSize, fieldSize, [
      { kind: 'core', origin: coreOrigin },
      { kind: 'source', origin: first.sourceOrigin, direction: first.sourceDirection },
    ])

    for (let b = a + 1; b < order.length; b++) {
      const second = order[b]!
      const sourceB = new SourceMachine(
        'source-b',
        second.sourceOrigin,
        second.sourceDirection,
        'circle',
        rules.sourcePeriodTicks,
      )
      if (withFirst.sourceOverlapsOccupied(sourceB)) continue

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