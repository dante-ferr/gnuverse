import assert from 'node:assert/strict'
import test from 'node:test'
import { Match } from '../game-server/pipeline/world/match.ts'
import {
  buyPreviewChunk,
  nextChunkCost,
} from '../game-server/pipeline/world/chunks/purchase.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

test('buyPreviewChunk owns a preview neighbor and remaps when the origin moves west', () => {
  const rules = testPipelineRules({ chunkSize: 24, mapChunkExtent: 64 })
  const match = Match.create('chunk-buy', rules)
  const starter = match.ownedChunks[0]!
  const west = { cx: starter.cx - 1, cy: starter.cy }
  const east = { cx: starter.cx + 1, cy: starter.cy }
  assert.ok(match.previewChunks.some((c) => c.cx === west.cx && c.cy === west.cy))

  const coreBefore = { ...match.core.origin }
  const widthBefore = match.width
  const originBefore = { ...match.originChunk }
  assert.equal(buyPreviewChunk(match, west), null)
  assert.equal(match.ownedChunks.length, 2)
  assert.ok(match.ownedChunks.some((c) => c.cx === west.cx && c.cy === west.cy))
  // Buying west adds a further west preview, so the visible AABB origin moves left.
  assert.equal(match.originChunk.cx, west.cx - 1)
  assert.equal(match.width, widthBefore + rules.chunkSize)
  assert.equal(
    match.core.origin.x,
    coreBefore.x + (originBefore.cx - match.originChunk.cx) * rules.chunkSize,
  )
  assert.ok(match.isOwnedCell(match.core.origin))
  assert.equal(buyPreviewChunk(match, east), null)
  assert.equal(match.ownedChunks.length, 3)
  assert.equal(nextChunkCost(match), rules.chunkCostBase + rules.chunkCostStep * 2)
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
  const starter = match.ownedChunks[0]!
  const far = { cx: starter.cx + 2, cy: starter.cy }
  assert.equal(buyPreviewChunk(match, far), 'Esse trecho não está à venda.')
  assert.equal(buyPreviewChunk(match, starter), 'Esse trecho não está à venda.')
})
