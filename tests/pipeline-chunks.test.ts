import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cellToChunk,
  chunkOriginCell,
  chunkInExtent,
  chunkPurchaseCost,
  previewCoords,
  starterChunkCoord,
  type ChunkCoord,
} from '../game-server/pipeline/world/chunks.ts'

test('starterChunkCoord centers inside an odd or even extent', () => {
  assert.deepEqual(starterChunkCoord(64), { cx: 31, cy: 31 })
  assert.deepEqual(starterChunkCoord(65), { cx: 32, cy: 32 })
  assert.deepEqual(starterChunkCoord(3), { cx: 1, cy: 1 })
})

test('cellToChunk and chunkOriginCell round-trip chunk boundaries', () => {
  const size = 24
  const coord: ChunkCoord = { cx: 2, cy: -1 }
  assert.deepEqual(chunkOriginCell(coord, size), { x: 48, y: -24 })
  assert.deepEqual(cellToChunk({ x: 48, y: 0 }, size), { cx: 2, cy: 0 })
  assert.deepEqual(cellToChunk({ x: 47, y: 23 }, size), { cx: 1, cy: 0 })
})

test('chunkInExtent rejects out-of-range coords', () => {
  const extent = 64
  assert.equal(chunkInExtent({ cx: 0, cy: 0 }, extent), true)
  assert.equal(chunkInExtent({ cx: 63, cy: 63 }, extent), true)
  assert.equal(chunkInExtent({ cx: 64, cy: 0 }, extent), false)
  assert.equal(chunkInExtent({ cx: -1, cy: 2 }, extent), false)
})

test('previewCoords lists Chebyshev ring neighbors not already owned', () => {
  const extent = 64
  const owned = [starterChunkCoord(extent)]
  const ring = 1
  const preview = previewCoords(owned, ring, extent)
  assert.equal(preview.length, 8)
  for (const coord of preview) {
    const d = Math.max(Math.abs(coord.cx - owned[0].cx), Math.abs(coord.cy - owned[0].cy))
    assert.equal(d, 1)
  }
  assert.ok(!preview.some((c) => c.cx === owned[0].cx && c.cy === owned[0].cy))
})

test('previewCoords unions rings around multiple owned chunks', () => {
  const owned: ChunkCoord[] = [
    { cx: 1, cy: 1 },
    { cx: 3, cy: 1 },
  ]
  const preview = previewCoords(owned, 1, 8)
  const keys = new Set(preview.map((c) => `${c.cx},${c.cy}`))
  assert.ok(keys.has('2,1'))
  assert.ok(keys.has('1,0'))
  assert.ok(!keys.has('1,1'))
  assert.ok(!keys.has('3,1'))
})

test('chunkPurchaseCost applies growth from the free starter', () => {
  const base = 5
  const growth = 2
  assert.equal(chunkPurchaseCost(1, base, growth), 5)
  assert.equal(chunkPurchaseCost(2, base, growth), 10)
  assert.equal(chunkPurchaseCost(3, base, growth), 20)
  assert.equal(chunkPurchaseCost(4, base, growth), 40)
  assert.equal(chunkPurchaseCost(5, base, growth), 80)
})