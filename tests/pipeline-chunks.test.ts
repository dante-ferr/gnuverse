import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cellChunkState,
  cellToChunk,
  chunkOriginCell,
  chunkInExtent,
  chunkPurchaseCost,
  previewCoords,
  starterChunkCoord,
  visibleAabb,
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

test('previewCoords lists orthogonal edge neighbors not already owned', () => {
  const extent = 64
  const owned = [starterChunkCoord(extent)]
  const preview = previewCoords(owned, extent)
  assert.equal(preview.length, 4)
  for (const coord of preview) {
    const manhattan =
      Math.abs(coord.cx - owned[0].cx) + Math.abs(coord.cy - owned[0].cy)
    assert.equal(manhattan, 1)
  }
  assert.ok(!preview.some((c) => c.cx === owned[0].cx && c.cy === owned[0].cy))
})

test('previewCoords unions edge neighbors around multiple owned chunks', () => {
  const owned: ChunkCoord[] = [
    { cx: 1, cy: 1 },
    { cx: 3, cy: 1 },
  ]
  const preview = previewCoords(owned, 8)
  const keys = new Set(preview.map((c) => `${c.cx},${c.cy}`))
  assert.ok(keys.has('2,1'))
  assert.ok(keys.has('1,0'))
  assert.ok(!keys.has('1,1'))
  assert.ok(!keys.has('3,1'))
  assert.ok(!keys.has('2,0'), 'diagonal between owned chunks is not a preview')
  assert.ok(!keys.has('2,2'), 'diagonal between owned chunks is not a preview')
})

test('visibleAabb sizes one owned chunk plus four edge previews', () => {
  const chunkSize = 24
  const owned = [starterChunkCoord(64)]
  const preview = previewCoords(owned, 64)
  const aabb = visibleAabb([...owned, ...preview], chunkSize)
  assert.equal(aabb.width, 72)
  assert.equal(aabb.height, 72)
})

test('cellChunkState marks owned, preview, and void inside the visible grid', () => {
  const chunkSize = 24
  const owned: ChunkCoord[] = [{ cx: 1, cy: 1 }]
  const preview: ChunkCoord[] = [{ cx: 2, cy: 1 }]
  const origin = { cx: 1, cy: 1 }
  assert.equal(cellChunkState({ x: 0, y: 0 }, owned, preview, origin, chunkSize), 'owned')
  assert.equal(cellChunkState({ x: 24, y: 0 }, owned, preview, origin, chunkSize), 'preview')
  assert.equal(cellChunkState({ x: 0, y: 24 }, owned, preview, origin, chunkSize), 'void')
})

test('chunkPurchaseCost is linear from the free starter', () => {
  const base = 5
  const step = 2
  assert.equal(chunkPurchaseCost(1, base, step), 5)
  assert.equal(chunkPurchaseCost(2, base, step), 7)
  assert.equal(chunkPurchaseCost(3, base, step), 9)
  assert.equal(chunkPurchaseCost(4, base, step), 11)
  assert.equal(chunkPurchaseCost(5, base, step), 13)
})