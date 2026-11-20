import { CoreMachine } from '../../machines/core-machine.ts'
import { SourceMachine } from '../../machines/source-machine.ts'
import { sourcePeriodTicksForRole } from '../../elements/rate.ts'
import type { Match } from '../match.ts'
import type { OccupiedMachine, PlacedSource } from '../types.ts'
import { generateChunkSources, type ChunkSourceKind } from '../placement/generate-chunk.ts'
import { chunkKey, type ChunkCoord } from './coords.ts'
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

/** First-time sources for a world chunk (preview buy or new preview ring). */
export function generateSourcesForChunk(
  match: Match,
  coord: ChunkCoord,
  kind: ChunkSourceKind,
): void {
  const key = chunkKey(coord)
  if (match.generatedChunkKeys.has(key)) return
  match.generatedChunkKeys.add(key)

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
}