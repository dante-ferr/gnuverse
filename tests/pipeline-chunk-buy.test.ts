import assert from 'node:assert/strict'
import test from 'node:test'
import { Match } from '../game-server/pipeline/world/match.ts'
import {
  buyPreviewChunk,
  nextChunkCost,
} from '../game-server/pipeline/world/chunks/purchase.ts'
import { starterChunkCoord } from '../game-server/pipeline/world/chunks/coords.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

function pickPreviewNeighbor(
  match: ReturnType<typeof Match.create>,
  toward: 'west' | 'east',
) {
  const center = starterChunkCoord(match.rules.mapChunkExtent)
  const owned = match.ownedChunks.find((coord) => coord.cx === center.cx && coord.cy === center.cy)!
  const target = { cx: owned.cx + (toward === 'west' ? -1 : 1), cy: owned.cy }
  return match.previewChunks.find((coord) => coord.cx === target.cx && coord.cy === target.cy)
}

test('buyPreviewChunk owns a preview neighbor and remaps when the origin moves west', () => {
  const rules = testPipelineRules({ chunkSize: 24, mapChunkExtent: 64 })
  const match = Match.create('chunk-buy', rules)
  const west = pickPreviewNeighbor(match, 'west') ?? pickPreviewNeighbor(match, 'east')
  assert.ok(west, 'expected a preview chunk beside the starter')

  const coreBefore = { ...match.core.origin }
  const widthBefore = match.width
  const originBefore = { ...match.originChunk }
  const ownedBefore = match.ownedChunks.length
  assert.equal(buyPreviewChunk(match, west), null)
  assert.equal(match.ownedChunks.length, ownedBefore + 1)
  assert.ok(match.ownedChunks.some((c) => c.cx === west.cx && c.cy === west.cy))
  if (west.cx < originBefore.cx) {
    assert.equal(match.originChunk.cx, west.cx - 1)
    assert.equal(match.width, widthBefore + rules.chunkSize)
    assert.equal(
      match.core.origin.x,
      coreBefore.x + (originBefore.cx - match.originChunk.cx) * rules.chunkSize,
    )
  }
  assert.ok(match.isOwnedCell(match.core.origin))
})

test('buyPreviewChunk remaps every sandbox core when the origin moves west', () => {
  const rules = testPipelineRules({ chunkSize: 24, mapChunkExtent: 64 })
  const match = Match.createSandbox('chunk-buy-sandbox', rules)
  assert.ok(match.cores.length >= 2)
  const west = match.previewChunks.find((preview) =>
    match.ownedChunks.some((owned) => owned.cx === preview.cx + 1 && owned.cy === preview.cy),
  )
  assert.ok(west)
  const before = match.cores.map((core) => ({ ...core.origin }))
  const originBefore = { ...match.originChunk }
  assert.equal(buyPreviewChunk(match, west), null)
  const dx = (originBefore.cx - match.originChunk.cx) * rules.chunkSize
  assert.ok(dx > 0)
  for (const [index, core] of match.cores.entries()) {
    assert.equal(core.origin.x, before[index]!.x + dx)
    assert.equal(core.origin.y, before[index]!.y)
    assert.ok(match.isOwnedCell(core.origin))
  }
})

test('buyPreviewChunk rejects chunks that are not currently previewed', () => {
  const rules = testPipelineRules({ chunkSize: 24, mapChunkExtent: 64 })
  const match = Match.create('chunk-reject', rules)
  const center = starterChunkCoord(rules.mapChunkExtent)
  const far = { cx: center.cx + 10, cy: center.cy + 10 }
  assert.equal(buyPreviewChunk(match, far), 'Esse trecho não está à venda.')
  assert.equal(buyPreviewChunk(match, center), 'Esse trecho não está à venda.')
  assert.equal(nextChunkCost(match), rules.chunkCostBase + rules.chunkCostStep * (match.ownedChunks.length - 1))
})