import { createSeedRng } from '../../geometry/seed-rng.ts'
import type { Cell } from '../../geometry/cell.ts'

export type ChunkCoord = { cx: number; cy: number }

const ORTHOGONAL_OFFSETS: readonly [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

export function chunkKey(coord: ChunkCoord): string {
  return `${coord.cx},${coord.cy}`
}

/** Chebyshev distance between chunk indices. */
export function chebyshevDistance(a: ChunkCoord, b: ChunkCoord): number {
  return Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy))
}

/** Eight chunks around `center` at Chebyshev distance 1. */
export function mooreNeighborChunks(center: ChunkCoord): ChunkCoord[] {
  const out: ChunkCoord[] = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      out.push({ cx: center.cx + dx, cy: center.cy + dy })
    }
  }
  out.sort((a, b) => a.cy - b.cy || a.cx - b.cx)
  return out
}

/** Seed-pick `count` satellite chunks in an inclusive Chebyshev ring. */
export function pickSatelliteChunkCoords(
  seed: string,
  starter: ChunkCoord,
  extent: number,
  count: number,
  ringMin: number,
  ringMax: number,
): ChunkCoord[] {
  const candidates: ChunkCoord[] = []
  for (let dy = -ringMax; dy <= ringMax; dy++) {
    for (let dx = -ringMax; dx <= ringMax; dx++) {
      if (dx === 0 && dy === 0) continue
      const dist = Math.max(Math.abs(dx), Math.abs(dy))
      if (dist < ringMin || dist > ringMax) continue
      const coord = { cx: starter.cx + dx, cy: starter.cy + dy }
      if (chunkInExtent(coord, extent)) candidates.push(coord)
    }
  }
  if (candidates.length < count) {
    throw new Error(
      `Not enough satellite slots: need ${count}, ring ${ringMin}-${ringMax} has ${candidates.length}`,
    )
  }
  const rng = createSeedRng(`${seed}:satellites`)
  const pool = [...candidates]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return pool.slice(0, count).sort((a, b) => a.cy - b.cy || a.cx - b.cx)
}

/**
 * Pick one edge-adjacent (N/E/S/W) neighbor of the starter for the grass guarantee.
 * Orthogonal only so the chunk is in the initial preview set without owning it.
 */
export function pickGrassNeighborChunk(
  seed: string,
  starter: ChunkCoord,
  extent: number,
  exclude: ChunkCoord[],
): ChunkCoord {
  const excludeKeys = new Set(exclude.map(chunkKey))
  const candidates = ORTHOGONAL_OFFSETS.map(([dx, dy]) => ({
    cx: starter.cx + dx,
    cy: starter.cy + dy,
  })).filter((coord) => chunkInExtent(coord, extent) && !excludeKeys.has(chunkKey(coord)))
  if (candidates.length === 0) {
    throw new Error('No orthogonal neighbor available for grass guarantee')
  }
  const rng = createSeedRng(`${seed}:grass`)
  return candidates[Math.floor(rng() * candidates.length)]!
}

/** Centered starter chunk index for a square extent (cells per axis = extent chunks). */
export function starterChunkCoord(extent: number): ChunkCoord {
  const index = Math.floor((extent - 1) / 2)
  return { cx: index, cy: index }
}

/** World-space top-left cell of a chunk. */
export function chunkOriginCell(coord: ChunkCoord, chunkSize: number): Cell {
  return { x: coord.cx * chunkSize, y: coord.cy * chunkSize }
}

export function cellToChunk(cell: Cell, chunkSize: number): ChunkCoord {
  return {
    cx: Math.floor(cell.x / chunkSize),
    cy: Math.floor(cell.y / chunkSize),
  }
}

export function chunkInExtent(coord: ChunkCoord, extent: number): boolean {
  return coord.cx >= 0 && coord.cy >= 0 && coord.cx < extent && coord.cy < extent
}

/** Preview chunks: edge-adjacent (N/E/S/W) to any owned chunk, not owned, inside extent. */
export function previewCoords(owned: ChunkCoord[], extent: number): ChunkCoord[] {
  const ownedKeys = new Set(owned.map(chunkKey))
  const previewKeys = new Set<string>()
  const result: ChunkCoord[] = []

  for (const origin of owned) {
    for (const [dx, dy] of ORTHOGONAL_OFFSETS) {
      const coord = { cx: origin.cx + dx, cy: origin.cy + dy }
      if (!chunkInExtent(coord, extent)) continue
      const key = chunkKey(coord)
      if (ownedKeys.has(key) || previewKeys.has(key)) continue
      previewKeys.add(key)
      result.push(coord)
    }
  }

  result.sort((a, b) => a.cy - b.cy || a.cx - b.cx)
  return result
}

/**
 * Coin cost for the next chunk purchase. Starter counts as one owned chunk (free).
 * Purchase index n = ownedCount - 1 → base + step * n.
 */
export function chunkPurchaseCost(ownedCount: number, base: number, step: number): number {
  if (ownedCount < 1) return base
  const n = ownedCount - 1
  const cost = base + step * n
  if (cost >= Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER
  return cost
}

export type ChunkCellState = 'owned' | 'preview' | 'void'

/** Stable `"cx,cy"` keys for membership tests without rebuilding per cell. */
export function chunkKeySet(coords: ChunkCoord[]): Set<string> {
  return new Set(coords.map(chunkKey))
}

/** World chunk AABB covering every coord in `chunks` (typically owned ∪ preview). */
export function visibleAabb(chunks: ChunkCoord[], chunkSize: number): {
  originChunk: ChunkCoord
  width: number
  height: number
} {
  if (chunks.length === 0) throw new Error('visibleAabb requires at least one chunk')
  let minCx = chunks[0]!.cx
  let maxCx = chunks[0]!.cx
  let minCy = chunks[0]!.cy
  let maxCy = chunks[0]!.cy
  for (const coord of chunks) {
    minCx = Math.min(minCx, coord.cx)
    maxCx = Math.max(maxCx, coord.cx)
    minCy = Math.min(minCy, coord.cy)
    maxCy = Math.max(maxCy, coord.cy)
  }
  const chunkWidth = maxCx - minCx + 1
  const chunkHeight = maxCy - minCy + 1
  return {
    originChunk: { cx: minCx, cy: minCy },
    width: chunkWidth * chunkSize,
    height: chunkHeight * chunkSize,
  }
}

/** Local match cell → owned / preview / void using prebuilt key sets. */
export function cellChunkStateFromSets(
  cell: Cell,
  ownedKeys: Set<string>,
  previewKeys: Set<string>,
  originChunk: ChunkCoord,
  chunkSize: number,
): ChunkCellState {
  const localCx = Math.floor(cell.x / chunkSize)
  const localCy = Math.floor(cell.y / chunkSize)
  const key = chunkKey({ cx: originChunk.cx + localCx, cy: originChunk.cy + localCy })
  if (ownedKeys.has(key)) return 'owned'
  if (previewKeys.has(key)) return 'preview'
  return 'void'
}

/** Local match cell → owned / preview / void inside the visible AABB. */
export function cellChunkState(
  cell: Cell,
  owned: ChunkCoord[],
  preview: ChunkCoord[],
  originChunk: ChunkCoord,
  chunkSize: number,
): ChunkCellState {
  return cellChunkStateFromSets(
    cell,
    chunkKeySet(owned),
    chunkKeySet(preview),
    originChunk,
    chunkSize,
  )
}