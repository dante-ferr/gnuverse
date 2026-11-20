import { CoreMachine } from '../../machines/core-machine.ts'
import { SourceMachine } from '../../machines/source-machine.ts'
import { sourcePeriodTicksForRole } from '../../elements/rate.ts'
import type { Match } from '../match.ts'
import type { OccupiedMachine, PlacedSource } from '../types.ts'
import { generateChunkSources, type ChunkSourceKind } from '../placement/generate-chunk.ts'
import {
  chebyshevDistance,
  chunkKey,
  starterChunkCoord,
  type ChunkCoord,
} from './coords.ts'
import { createSeedRng } from '../../geometry/seed-rng.ts'
import type { Cell } from '../../geometry/cell.ts'

function chunkLocalOrigin(coord: ChunkCoord, originChunk: ChunkCoord, chunkSize: number): Cell {
  return {
    x: (coord.cx - originChunk.cx) * chunkSize,
    y: (coord.cy - originChunk.cy) * chunkSize,
  }
}

function coreInChunk(chunkSize: number) {
  return {
    x: Math.floor((chunkSize - CoreMachine.size) / 2),
    y: Math.floor((chunkSize - CoreMachine.size) / 2),
  }
}

function occupiedFromMatch(match: Match): OccupiedMachine[] {
  const occupied: OccupiedMachine[] = []
  for (const core of match.cores) {
    occupied.push({ kind: 'core', origin: { ...core.origin } })
  }
  for (const source of match.sources) {
    occupied.push({
      kind: 'source',
      origin: { ...source.origin },
      direction: source.direction,
    })
  }
  return occupied
}

export function ingestPlacedSources(match: Match, specs: PlacedSource[]): void {
  for (const spec of specs) {
    match.sourceRoles[spec.id] = spec.role
    match.sources.push(
      new SourceMachine(
        spec.id,
        spec.origin,
        spec.direction,
        spec.shape,
        spec.sourcePeriodTicks ??
          sourcePeriodTicksForRole(match.rules.elements, match.rules.tickMs, spec.role),
      ),
    )
  }
}

/** Center a 5×5 core in a world chunk (satellite discovery or optional purchase). */
export function placeCoreInChunk(match: Match, coord: ChunkCoord): void {
  const chunkSize = match.rules.chunkSize
  const localOrigin = chunkLocalOrigin(coord, match.originChunk, chunkSize)
  const inset = coreInChunk(chunkSize)
  const origin: Cell = {
    x: localOrigin.x + inset.x,
    y: localOrigin.y + inset.y,
  }
  if (match.cores.some((core) => core.origin.x === origin.x && core.origin.y === origin.y)) {
    return
  }
  const id = `core-${match.cores.length}`
  match.cores.push(new CoreMachine(id, origin))
}

/** Place a satellite core when its reserved chunk first enters the visible set. */
export function discoverSatelliteCore(match: Match, coord: ChunkCoord): void {
  const key = chunkKey(coord)
  if (!match.satelliteChunkKeys.has(key)) return
  placeCoreInChunk(match, coord)
}

function maybeRollOptionalCore(match: Match, coord: ChunkCoord): void {
  if (match.sandbox) return
  const key = chunkKey(coord)
  if (match.satelliteChunkKeys.has(key)) return
  const starter = starterChunkCoord(match.rules.mapChunkExtent)
  if (chebyshevDistance(starter, coord) <= 4) return
  const chance = match.rules.optionalCoreSpawnChancePercent
  if (chance <= 0) return
  const rng = createSeedRng(`${match.seed}:optional-core:${coord.cx},${coord.cy}`)
  if (rng() * 100 >= chance) return
  match.optionalCoreChunkKeys.add(key)
}

/** First-time sources (and satellite core) for a world chunk entering preview. */
export function generateSourcesForChunk(
  match: Match,
  coord: ChunkCoord,
  kind: ChunkSourceKind,
): void {
  const key = chunkKey(coord)
  if (match.generatedChunkKeys.has(key)) return
  match.generatedChunkKeys.add(key)

  discoverSatelliteCore(match, coord)
  maybeRollOptionalCore(match, coord)

  const chunkSize = match.rules.chunkSize
  const localOrigin = chunkLocalOrigin(coord, match.originChunk, chunkSize)
  const specs = generateChunkSources(
    match.rules,
    match.seed,
    coord,
    localOrigin,
    occupiedFromMatch(match),
    kind,
    coreInChunk(chunkSize),
  )
  ingestPlacedSources(match, specs)
}

export function generatePendingPreviewChunks(match: Match): void {
  for (const coord of match.previewChunks) {
    const key = chunkKey(coord)
    if (match.generatedChunkKeys.has(key)) continue
    const kind = key === match.grassChunkKey ? 'grass' : 'normal'
    generateSourcesForChunk(match, coord, kind)
  }
  // Owned satellite chunks (bought after discovery) must still get a core if
  // generation raced ahead of satellite key wiring on legacy frames.
  for (const coord of match.ownedChunks) {
    discoverSatelliteCore(match, coord)
  }
}
