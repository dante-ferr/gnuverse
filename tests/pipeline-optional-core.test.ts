import assert from 'node:assert/strict'
import test from 'node:test'
import { Match } from '../game-server/pipeline/world/match.ts'
import {
  chebyshevDistance,
  starterChunkCoord,
} from '../game-server/pipeline/world/chunks/coords.ts'
import { generateSourcesForChunk } from '../game-server/pipeline/world/chunks/chunk-generation.ts'
import {
  applyCoreContribution,
  quoteCoreContribution,
} from '../game-server/pipeline/world/chunks/core-purchase.ts'
import { buyPreviewChunk } from '../game-server/pipeline/world/chunks/purchase.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

test('optional core roll only beyond ring 4', () => {
  const rules = testPipelineRules({
    mapChunkExtent: 64,
    optionalCoreSpawnChancePercent: 100,
  })
  const match = Match.create('opt-core-roll', rules)
  const starter = starterChunkCoord(rules.mapChunkExtent)
  const ring4 = { cx: starter.cx + 4, cy: starter.cy }
  const ring5 = { cx: starter.cx + 5, cy: starter.cy }
  assert.equal(chebyshevDistance(starter, ring4), 4)
  assert.equal(chebyshevDistance(starter, ring5), 5)
  generateSourcesForChunk(match, ring4, 'normal')
  generateSourcesForChunk(match, ring5, 'normal')
  assert.equal(match.optionalCoreChunkKeys.has(`${ring4.cx},${ring4.cy}`), false)
  assert.equal(match.optionalCoreChunkKeys.has(`${ring5.cx},${ring5.cy}`), true)
  const coresBefore = match.cores.length
  generateSourcesForChunk(match, ring5, 'normal')
  assert.equal(match.cores.length, coresBefore)
})

test('optional core buy requires owned chunk and places core at pooled price', () => {
  const rules = testPipelineRules({
    mapChunkExtent: 64,
    optionalCoreSpawnChancePercent: 100,
    optionalCoreCost: 400,
    chunkCostBase: 1,
    chunkCostStep: 0,
  })
  const match = Match.create('opt-core-buy', rules)
  const starter = starterChunkCoord(rules.mapChunkExtent)
  const target = { cx: starter.cx + 5, cy: starter.cy }
  generateSourcesForChunk(match, target, 'normal')
  assert.ok(match.optionalCoreChunkKeys.has(`${target.cx},${target.cy}`))
  assert.equal(quoteCoreContribution(match, target, 50).ok, false)
  match.previewChunks.push({ ...target })
  match.rebuildChunkKeys()
  assert.equal(buyPreviewChunk(match, target), null)
  const coresBefore = match.cores.length
  const quote = quoteCoreContribution(match, target, 400)
  assert.ok(quote.ok)
  const funded = applyCoreContribution(match, target, 'u1', 400)
  assert.equal(funded.completed, true)
  assert.equal(funded.cost, 400)
  assert.equal(match.optionalCoreChunkKeys.has(`${target.cx},${target.cy}`), false)
  const coresAfter = match.cores.length
  assert.ok(coresAfter > coresBefore)
  const frame = match.toFrame()
  assert.equal(frame.optionalCoreChunkKeys?.includes(`${target.cx},${target.cy}`), false)
  const restored = Match.fromFrame(frame, match.rules)
  assert.equal(restored.corePledges.length, 0)
})