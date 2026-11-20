import type { Cell } from '../../geometry/cell.ts'
import type { Direction } from '../../geometry/direction.ts'
import { createSeedRng } from '../../geometry/seed-rng.ts'
import { SourceMachine } from '../../machines/source-machine.ts'
import { sourcePeriodTicksForElement } from '../../elements/rate.ts'
import type { PipelineRules } from '../../rules.ts'
import type { ChunkCoord } from '../chunks/coords.ts'
import type { OccupiedMachine, PlacedSource } from '../types.ts'
import { layoutStarterSources } from './approach.ts'
import { PlacementField } from './field.ts'

export type ChunkSourceKind = 'starter' | 'grass' | 'normal'

function occupiedInChunkSpace(
  occupied: OccupiedMachine[],
  chunkLocalOrigin: Cell,
  chunkSize: number,
): OccupiedMachine[] {
  const x0 = chunkLocalOrigin.x
  const y0 = chunkLocalOrigin.y
  const x1 = x0 + chunkSize - 1
  const y1 = y0 + chunkSize - 1
  const out: OccupiedMachine[] = []
  for (const machine of occupied) {
    const { x, y } = machine.origin
    if (x < x0 || y < y0 || x > x1 || y > y1) continue
    if (machine.kind === 'combiner') {
      out.push({
        ...machine,
        origin: { x: x - x0, y: y - y0 },
      })
    } else {
      out.push({
        ...machine,
        origin: { x: x - x0, y: y - y0 },
      })
    }
  }
  return out
}

/** Try one element source inside a chunk local rect; returns null when clearance fails. */
export function tryPlaceElementSourceInChunk(
  rules: PipelineRules,
  subSeed: string,
  chunkLocalOrigin: Cell,
  chunkSize: number,
  occupied: OccupiedMachine[],
  elementId: string,
  idSuffix: string,
): PlacedSource | null {
  const chunkOccupied = occupiedInChunkSpace(occupied, chunkLocalOrigin, chunkSize)
  const field = new PlacementField(rules, chunkSize, chunkSize, chunkOccupied)
  const rng = createSeedRng(subSeed)
  const dirs: Direction[] = ['north', 'east', 'south', 'west']
  const trials: { x: number; y: number; direction: Direction }[] = []
  for (const direction of dirs) {
    for (let y = 0; y <= chunkSize - SourceMachine.size; y++) {
      for (let x = 0; x <= chunkSize - SourceMachine.size; x++) {
        trials.push({ x, y, direction })
      }
    }
  }
  for (let i = trials.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[trials[i], trials[j]] = [trials[j]!, trials[i]!]
  }

  const el = rules.elements.elements.find((item) => item.id === elementId)
  if (!el) return null

  for (const trial of trials) {
    const origin = { x: trial.x, y: trial.y }
    const source = new SourceMachine(
      'probe',
      origin,
      trial.direction,
      elementId,
      sourcePeriodTicksForElement(rules.elements, rules.tickMs, el),
    )
    if (!field.footprintInBounds(source)) continue
    if (field.sourceOverlapsOccupied(source)) continue

    return {
      id: `source-${idSuffix}-${elementId}`,
      origin: {
        x: origin.x + chunkLocalOrigin.x,
        y: origin.y + chunkLocalOrigin.y,
      },
      direction: source.direction,
      shape: elementId,
      role: elementId,
      sourcePeriodTicks: sourcePeriodTicksForElement(rules.elements, rules.tickMs, el),
    }
  }
  return null
}

function shiftToMatchOrigin(spec: PlacedSource, chunkLocalOrigin: Cell): PlacedSource {
  return {
    ...spec,
    origin: {
      x: spec.origin.x + chunkLocalOrigin.x,
      y: spec.origin.y + chunkLocalOrigin.y,
    },
  }
}

function tierOneRollable(rules: PipelineRules, startersOnlyOnStarter: boolean) {
  const starters = new Set(rules.elements.starterSourceIds)
  return rules.elements.elements.filter((el) => {
    if (el.tier !== 1) return false
    if (startersOnlyOnStarter && starters.has(el.id)) return false
    const chance = el.source_spawn_chance_percent ?? 0
    return chance > 0
  })
}

/**
 * Probabilistic tier-1 bases for one chunk. Starter chunk uses `layoutStarterSources`;
 * grass chunks force grass when the roll misses.
 */
export function generateChunkSources(
  rules: PipelineRules,
  seed: string,
  coord: ChunkCoord,
  chunkLocalOrigin: Cell,
  occupied: OccupiedMachine[],
  kind: ChunkSourceKind,
  coreInChunk?: Cell,
): PlacedSource[] {
  const chunkSize = rules.chunkSize
  const subSeed = `${seed}:chunk:${coord.cx},${coord.cy}`
  const idSuffix = `${coord.cx},${coord.cy}`
  const placed: PlacedSource[] = []
  const workingOccupied = [...occupied]

  const pushSource = (spec: PlacedSource | null) => {
    if (!spec) return
    placed.push(spec)
    workingOccupied.push({
      kind: 'source',
      origin: spec.origin,
      direction: spec.direction,
    })
  }

  if (kind === 'starter') {
    if (!coreInChunk) throw new Error('starter chunk generation needs coreInChunk')
    const starters = layoutStarterSources(rules, `${subSeed}:starters`, coreInChunk, chunkSize)
    for (const spec of starters) {
      const shifted = shiftToMatchOrigin(spec, chunkLocalOrigin)
      placed.push(shifted)
      workingOccupied.push({
        kind: 'source',
        origin: shifted.origin,
        direction: shifted.direction,
      })
    }
    return placed
  }

  const rng = createSeedRng(`${subSeed}:spawn`)
  const rollables = tierOneRollable(rules, true)
  let hasGrass = false

  for (const el of rollables) {
    const chance = el.source_spawn_chance_percent ?? 0
    if (chance <= 0) continue
    if (rng() * 100 >= chance) continue
    const spec = tryPlaceElementSourceInChunk(
      rules,
      `${subSeed}:${el.id}`,
      chunkLocalOrigin,
      chunkSize,
      workingOccupied,
      el.id,
      idSuffix,
    )
    if (!spec) continue
    if (el.id === 'grass') hasGrass = true
    pushSource(spec)
  }

  if (kind === 'grass' && !hasGrass) {
    const spec = tryPlaceElementSourceInChunk(
      rules,
      `${subSeed}:grass-force`,
      chunkLocalOrigin,
      chunkSize,
      workingOccupied,
      'grass',
      idSuffix,
    )
    pushSource(spec)
  }

  return placed
}