import type { Cell } from '../../geometry/cell.ts'
import type { Direction } from '../../geometry/direction.ts'
import { createSeedRng } from '../../geometry/seed-rng.ts'
import { SourceMachine } from '../../machines/source-machine.ts'
import type { PipelineRules } from '../../rules.ts'
import type { OccupiedMachine, PlacedSource } from '../types.ts'
import { PlacementField } from './field.ts'

/** Try one circle source inside a chunk local rect; returns null when clearance fails. */
export function tryPlaceCircleSourceInChunk(
  rules: PipelineRules,
  subSeed: string,
  chunkOrigin: Cell,
  chunkSize: number,
  occupied: OccupiedMachine[],
): PlacedSource | null {
  const field = new PlacementField(rules, chunkSize, chunkSize, occupied)
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

    if (field.sourceOverlapsOccupied(source)) continue

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