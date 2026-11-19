import type { Cell } from '../../geometry/cell.ts'
import type { Direction } from '../../geometry/direction.ts'
import type { SideDepths } from '../../geometry/clearance.ts'
import { createSeedRng } from '../../geometry/seed-rng.ts'
import { CoreMachine } from '../../machines/core-machine.ts'
import { SourceMachine } from '../../machines/source-machine.ts'
import {
  defaultSourcePeriodTicks,
  sourcePeriodTicksForElement,
} from '../../elements/rate.ts'
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
    defaultSourcePeriodTicks(field.rules.elements, field.rules.tickMs),
  )

  if (!field.footprintInBounds(source)) return
  if (field.sourceOverlapsOccupied(source)) return

  out.push({ sourceOrigin, sourceDirection })
}

/**
 * Places one starter source per id in `rules.elements.starterSourceIds`
 * (from elements.toml), clearance-separated around the core.
 */
export function layoutStarterSources(
  rules: PipelineRules,
  seed: string,
  coreOrigin: Cell,
  fieldSize: number,
): PlacedSource[] {
  const starterIds = rules.elements.starterSourceIds
  if (starterIds.length < 1) {
    throw new Error('elements.toml: starter_source_ids must list at least one base')
  }

  const byId = new Map(rules.elements.elements.map((el) => [el.id, el]))
  for (const id of starterIds) {
    const el = byId.get(id)
    if (!el || el.tier !== 1) {
      throw new Error(`elements.toml: starter_source_ids entry "${id}" must be a tier-1 base`)
    }
  }

  const field = new PlacementField(rules, fieldSize, fieldSize, [
    { kind: 'core', origin: coreOrigin },
  ])
  if (!field.footprintInBounds(new CoreMachine('core', coreOrigin)))
    throw new Error(`Field ${fieldSize}×${fieldSize} cannot fit the core at (${coreOrigin.x}, ${coreOrigin.y})`)

  const coreDepths = field.coreDepthsAt(coreOrigin)
  const candidates = collectLayoutCandidates(rules, coreOrigin, coreDepths, fieldSize, fieldSize)
  if (candidates.length < starterIds.length) {
    throw new Error(
      `Field ${fieldSize}×${fieldSize} is too small for core and ${starterIds.length} starter sources with clearance`,
    )
  }

  const rng = createSeedRng(seed)
  const order = [...candidates]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }

  const placed: PlacedSource[] = []
  const occupied = new PlacementField(rules, fieldSize, fieldSize, [
    { kind: 'core', origin: coreOrigin },
  ])

  for (const elementId of starterIds) {
    let found: LayoutCandidate | null = null
    for (const candidate of order) {
      const probe = new SourceMachine(
        `source-${elementId}`,
        candidate.sourceOrigin,
        candidate.sourceDirection,
        'circle',
        defaultSourcePeriodTicks(rules.elements, rules.tickMs),
      )
      if (occupied.sourceOverlapsOccupied(probe)) continue
      found = candidate
      break
    }
    if (!found) {
      throw new Error(
        `Field ${fieldSize}×${fieldSize} has no clearance placement for starter source "${elementId}"`,
      )
    }
    const el = byId.get(elementId)!
    placed.push({
      id: `source-${elementId}`,
      origin: found.sourceOrigin,
      direction: found.sourceDirection,
      shape: 'circle',
      role: elementId,
      sourcePeriodTicks: sourcePeriodTicksForElement(rules.elements, rules.tickMs, el),
    })
    occupied.addOccupied({
      kind: 'source',
      origin: found.sourceOrigin,
      direction: found.sourceDirection,
    })
    // Remove used candidate so the next starter picks a different pad.
    const usedKey = `${found.sourceOrigin.x},${found.sourceOrigin.y},${found.sourceDirection}`
    for (let i = order.length - 1; i >= 0; i--) {
      const c = order[i]!
      if (`${c.sourceOrigin.x},${c.sourceOrigin.y},${c.sourceDirection}` === usedKey) {
        order.splice(i, 1)
      }
    }
  }

  return placed
}

/** @deprecated Prefer layoutStarterSources — kept for older call sites/tests. */
export function layoutTwoStarterSources(
  rules: PipelineRules,
  seed: string,
  coreOrigin: Cell,
  fieldSize: number,
): [PlacedSource, PlacedSource] {
  const placed = layoutStarterSources(rules, seed, coreOrigin, fieldSize)
  if (placed.length < 2) {
    throw new Error('Expected at least two starter sources in elements.toml starter_source_ids')
  }
  return [placed[0]!, placed[1]!]
}
