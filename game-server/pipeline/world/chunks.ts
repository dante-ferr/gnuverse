import type { Cell } from '../geometry/cell.ts'

export type ChunkCoord = { cx: number; cy: number }

function chunkKey(coord: ChunkCoord): string {
  return `${coord.cx},${coord.cy}`
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

function chebyshevDistance(a: ChunkCoord, b: ChunkCoord): number {
  return Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy))
}

/** Preview chunks: within `ring` Chebyshev steps of any owned chunk, not owned, inside extent. */
export function previewCoords(
  owned: ChunkCoord[],
  ring: number,
  extent: number,
): ChunkCoord[] {
  const ownedKeys = new Set(owned.map(chunkKey))
  const previewKeys = new Set<string>()
  const result: ChunkCoord[] = []

  for (const origin of owned) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        const coord = { cx: origin.cx + dx, cy: origin.cy + dy }
        if (!chunkInExtent(coord, extent)) continue
        if (chebyshevDistance(origin, coord) > ring) continue
        const key = chunkKey(coord)
        if (ownedKeys.has(key) || previewKeys.has(key)) continue
        previewKeys.add(key)
        result.push(coord)
      }
    }
  }

  result.sort((a, b) => a.cy - b.cy || a.cx - b.cx)
  return result
}

/**
 * Coin cost for the next chunk purchase. Starter counts as one owned chunk (free).
 * Purchase index n = ownedCount - 1 → floor(base * growth^n).
 */
export function chunkPurchaseCost(ownedCount: number, base: number, growth: number): number {
  if (ownedCount < 1) return base
  let n = ownedCount - 1
  let cost = base
  for (let i = 0; i < n; i++) {
    cost = Math.floor(cost * growth)
    if (cost >= Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER
  }
  return cost
}