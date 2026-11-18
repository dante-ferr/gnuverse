import type { Cell } from '../geometry/cell.ts'
import { CoreMachine } from '../machines/core-machine.ts'
import { SourceMachine } from '../machines/source-machine.ts'
import type { PipelineRules } from '../rules.ts'
import {
  previewCoords,
  starterChunkCoord,
  visibleAabb,
  type ChunkCoord,
} from './chunks.ts'
import { layoutTwoStarterSources, type PlacedSource } from './map-layout.ts'

export type MatchLayout = {
  originChunk: ChunkCoord
  width: number
  height: number
  ownedChunks: ChunkCoord[]
  previewChunks: ChunkCoord[]
  coreOrigin: Cell
  sources: PlacedSource[]
}

function chunkLocalOrigin(coord: ChunkCoord, originChunk: ChunkCoord, chunkSize: number): Cell {
  return {
    x: (coord.cx - originChunk.cx) * chunkSize,
    y: (coord.cy - originChunk.cy) * chunkSize,
  }
}

/** Seeded match grid: owned starter chunk + edge preview neighbors and their machines. */
export function layoutMatchFromSeed(rules: PipelineRules, seed: string): MatchLayout {
  const chunkSize = rules.chunkSize
  const extent = rules.mapChunkExtent
  const starter = starterChunkCoord(extent)
  const ownedChunks = [starter]
  const previewChunks = previewCoords(ownedChunks, extent)
  const visible = [...ownedChunks, ...previewChunks]
  const { originChunk, width, height } = visibleAabb(visible, chunkSize)

  const starterLocal = chunkLocalOrigin(starter, originChunk, chunkSize)
  const coreInChunk: Cell = {
    x: Math.floor((chunkSize - CoreMachine.size) / 2),
    y: Math.floor((chunkSize - CoreMachine.size) / 2),
  }
  const coreOrigin: Cell = {
    x: starterLocal.x + coreInChunk.x,
    y: starterLocal.y + coreInChunk.y,
  }

  const [fireLocal, waterLocal] = layoutTwoStarterSources(rules, seed, coreInChunk, chunkSize)
  const shift = (spec: PlacedSource): PlacedSource => ({
    ...spec,
    origin: { x: spec.origin.x + starterLocal.x, y: spec.origin.y + starterLocal.y },
  })
  const fire = shift(fireLocal)
  const water = shift(waterLocal)
  // Non-starter chunks stay empty for now. Probabilistic source spawn (TOML
  // source_spawn_chance_*_percent + clearance) is documented; not wired until
  // real element sources ship — chunks must not require a source.
  const sources: PlacedSource[] = [fire, water]

  return {
    originChunk,
    width,
    height,
    ownedChunks,
    previewChunks,
    coreOrigin,
    sources,
  }
}

export function machinesFromLayout(
  rules: PipelineRules,
  layout: MatchLayout,
): { core: CoreMachine; sources: SourceMachine[]; roles: Record<string, PlacedSource['role']> } {
  const roles: Record<string, PlacedSource['role']> = {}
  const sources = layout.sources.map((spec) => {
    roles[spec.id] = spec.role
    return new SourceMachine(
      spec.id,
      spec.origin,
      spec.direction,
      spec.shape,
      rules.sourcePeriodTicks,
    )
  })
  return { core: new CoreMachine('core', layout.coreOrigin), sources, roles }
}