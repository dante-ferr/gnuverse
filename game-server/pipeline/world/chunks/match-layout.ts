import type { Cell } from '../../geometry/cell.ts'
import { CoreMachine } from '../../machines/core-machine.ts'
import { SourceMachine } from '../../machines/source-machine.ts'
import { sourcePeriodTicksForRole } from '../../elements/rate.ts'
import type { PipelineRules } from '../../rules.ts'
import { generateChunkSources } from '../placement/generate-chunk.ts'
import type { OccupiedMachine, PlacedSource } from '../types.ts'
import {
  chunkKey,
  pickGrassNeighborChunk,
  pickSatelliteChunkCoords,
  previewCoords,
  starterChunkCoord,
  visibleAabb,
  type ChunkCoord,
} from './coords.ts'

export type MatchLayout = {
  originChunk: ChunkCoord
  width: number
  height: number
  ownedChunks: ChunkCoord[]
  previewChunks: ChunkCoord[]
  /** World chunk keys that already have generated sources. */
  generatedChunkKeys: string[]
  /** Seed-picked satellite chunks; cores appear when those chunks enter preview. */
  satelliteChunkKeys: string[]
  coreOrigins: Cell[]
  grassChunkKey: string
  sources: PlacedSource[]
}

function chunkLocalOrigin(coord: ChunkCoord, originChunk: ChunkCoord, chunkSize: number): Cell {
  return {
    x: (coord.cx - originChunk.cx) * chunkSize,
    y: (coord.cy - originChunk.cy) * chunkSize,
  }
}

function coreInChunk(chunkSize: number): Cell {
  return {
    x: Math.floor((chunkSize - CoreMachine.size) / 2),
    y: Math.floor((chunkSize - CoreMachine.size) / 2),
  }
}

/** Seeded match grid: starter + satellite cores, grass neighbor, and gradual sources. */
export function layoutMatchFromSeed(rules: PipelineRules, seed: string): MatchLayout {
  const chunkSize = rules.chunkSize
  const extent = rules.mapChunkExtent
  const starter = starterChunkCoord(extent)
  const satellites = pickSatelliteChunkCoords(
    seed,
    starter,
    extent,
    rules.satelliteCoreCount,
    rules.satelliteCoreRingMin,
    rules.satelliteCoreRingMax,
  )
  const grassNeighbor = pickGrassNeighborChunk(seed, starter, extent, [starter, ...satellites])

  const ownedKeys = new Set<string>()
  const ownedChunks: ChunkCoord[] = []
  const pushOwned = (coord: ChunkCoord) => {
    const key = chunkKey(coord)
    if (ownedKeys.has(key)) return
    ownedKeys.add(key)
    ownedChunks.push({ ...coord })
  }
  // Only the starter is playable at create. Grass sits in a preview neighbor until bought.
  pushOwned(starter)

  const satelliteChunkKeys = satellites.map((coord) => chunkKey(coord))
  const previewChunks = previewCoords(ownedChunks, extent)
  const visible = [...ownedChunks, ...previewChunks]
  const { originChunk, width, height } = visibleAabb(visible, chunkSize)

  const occupied: OccupiedMachine[] = []
  const coreLocalByKey = coreInChunk(chunkSize)
  const starterLocal = chunkLocalOrigin(starter, originChunk, chunkSize)
  const coreOrigin: Cell = {
    x: starterLocal.x + coreLocalByKey.x,
    y: starterLocal.y + coreLocalByKey.y,
  }
  const coreOrigins: Cell[] = [coreOrigin]
  occupied.push({ kind: 'core', origin: coreOrigin })

  const sources: PlacedSource[] = []
  const generatedChunkKeys: string[] = []
  const starterKey = chunkKey(starter)
  const grassKey = chunkKey(grassNeighbor)

  const chunksToGenerate = [...ownedChunks, ...previewChunks]
  const seenGenerate = new Set<string>()

  for (const coord of chunksToGenerate) {
    const key = chunkKey(coord)
    if (seenGenerate.has(key)) continue
    seenGenerate.add(key)
    generatedChunkKeys.push(key)

    const localOrigin = chunkLocalOrigin(coord, originChunk, chunkSize)

    if (key === starterKey) {
      const newSources = generateChunkSources(
        rules,
        seed,
        coord,
        localOrigin,
        occupied,
        'starter',
        coreLocalByKey,
      )
      sources.push(...newSources)
      for (const spec of newSources) {
        occupied.push({ kind: 'source', origin: spec.origin, direction: spec.direction })
      }
      continue
    }

    const kind = key === grassKey ? 'grass' : 'normal'
    const newSources = generateChunkSources(
      rules,
      seed,
      coord,
      localOrigin,
      occupied,
      kind,
      coreLocalByKey,
    )
    sources.push(...newSources)
    for (const spec of newSources) {
      occupied.push({ kind: 'source', origin: spec.origin, direction: spec.direction })
    }
  }

  return {
    originChunk,
    width,
    height,
    ownedChunks,
    previewChunks,
    generatedChunkKeys,
    satelliteChunkKeys,
    coreOrigins,
    grassChunkKey: grassKey,
    sources,
  }
}

export function machinesFromLayout(
  rules: PipelineRules,
  layout: MatchLayout,
): { cores: CoreMachine[]; sources: SourceMachine[]; roles: Record<string, PlacedSource['role']> } {
  const roles: Record<string, PlacedSource['role']> = {}
  const sources = layout.sources.map((spec) => {
    roles[spec.id] = spec.role
    return new SourceMachine(
      spec.id,
      spec.origin,
      spec.direction,
      spec.shape,
      spec.sourcePeriodTicks ??
        sourcePeriodTicksForRole(rules.elements, rules.tickMs, spec.role),
    )
  })
  const cores = layout.coreOrigins.map((origin, index) =>
    new CoreMachine(index === 0 ? 'core' : `core-${index}`, origin),
  )
  return { cores, sources, roles }
}