import assert from 'node:assert/strict'
import test from 'node:test'
import {
  chebyshevDistance,
  chunkKey,
  pickGrassNeighborChunk,
  pickSatelliteChunkCoords,
  starterChunkCoord,
} from '../game-server/pipeline/world/chunks/coords.ts'
import { buyPreviewChunk } from '../game-server/pipeline/world/chunks/purchase.ts'
import { Match } from '../game-server/pipeline/world/match.ts'
import { activeDemandShapes } from '../game-server/pipeline/world/progression/demands.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

const rules = testPipelineRules()

test('satellite picks sit in the Chebyshev ring', () => {
  const starter = starterChunkCoord(64)
  const satellites = pickSatelliteChunkCoords('ring-seed', starter, 64, 2, 3, 4)
  assert.equal(satellites.length, 2)
  for (const coord of satellites) {
    const dist = chebyshevDistance(starter, coord)
    assert.ok(dist >= 3 && dist <= 4)
  }
})

test('grass neighbor is an edge-adjacent preview neighbor of the starter', () => {
  const starter = starterChunkCoord(64)
  const satellites = pickSatelliteChunkCoords('grass-ring', starter, 64, 2, 3, 4)
  const grass = pickGrassNeighborChunk('grass-ring', starter, 64, [starter, ...satellites])
  assert.equal(chebyshevDistance(starter, grass), 1)
  assert.ok(
    grass.cx === starter.cx || grass.cy === starter.cy,
    'grass must be orthogonal so it starts as a buyable preview',
  )
})

test('Match.create owns starter only; grass stays preview until bought', () => {
  const match = Match.create('progression-layout', rules)
  assert.equal(match.cores.length, 1)
  assert.equal(match.ownedChunks.length, 1)
  assert.equal(match.satelliteChunkKeys.size, rules.satelliteCoreCount)
  assert.ok(match.grassChunkKey)
  assert.ok(
    match.previewChunks.some((coord) => chunkKey(coord) === match.grassChunkKey),
    'grass neighbor should be preview at create',
  )
  const grassSources = match.sources.filter((source) => source.shape === 'grass')
  assert.ok(grassSources.length >= 1, 'grass source should be generated at create')
  assert.ok(
    grassSources.every((source) => !match.isOwnedCell(source.origin)),
    'grass source must not start on an owned cell',
  )
  for (const key of match.satelliteChunkKeys) {
    assert.ok(
      !match.ownedChunks.some((coord) => chunkKey(coord) === key),
      'satellite chunks must not start owned',
    )
  }
})

test('buying out to a satellite chunk discovers its core', () => {
  const match = Match.create('discover-satellite', rules)
  assert.equal(match.cores.length, 1)
  const satKey = [...match.satelliteChunkKeys][0]!
  const [sx, sy] = satKey.split(',').map(Number)
  const target = { cx: sx!, cy: sy! }

  // Orthogonal path from starter toward the satellite until the satellite is previewable.
  let guard = 0
  while (
    !match.previewChunks.some((coord) => chunkKey(coord) === satKey) &&
    !match.ownedChunks.some((coord) => chunkKey(coord) === satKey) &&
    guard < 16
  ) {
    guard += 1
    const starter = match.ownedChunks[0]!
    const step = {
      cx: starter.cx + Math.sign(target.cx - starter.cx),
      cy: starter.cy + Math.sign(target.cy - starter.cy),
    }
    // Prefer a pure orthogonal step when both axes need movement.
    const candidates = match.previewChunks.filter((coord) => {
      const towardX = Math.abs(coord.cx - target.cx) < Math.abs(starter.cx - target.cx)
      const towardY = Math.abs(coord.cy - target.cy) < Math.abs(starter.cy - target.cy)
      return towardX || towardY
    })
    const next = candidates[0] ?? match.previewChunks[0]
    assert.ok(next, 'expected a preview chunk to buy')
    assert.equal(buyPreviewChunk(match, next), null)
  }

  if (!match.ownedChunks.some((coord) => chunkKey(coord) === satKey)) {
    assert.ok(
      match.previewChunks.some((coord) => chunkKey(coord) === satKey),
      'satellite should enter preview before buy',
    )
    assert.ok(match.cores.length >= 2, 'core appears when satellite chunk is previewed')
    assert.equal(buyPreviewChunk(match, target), null)
  }
  assert.ok(match.cores.length >= 2)
  assert.ok(match.ownedChunks.some((coord) => chunkKey(coord) === satKey))
})

test('chapter 1 demands cover fire, water, and steam', () => {
  const match = Match.create('chapter-one', rules)
  const shapes = activeDemandShapes(match.chapter, rules, false)
  assert.deepEqual(shapes.sort(), ['fire', 'steam', 'water'])
})

test('auto unlock advances chapter when chapter-1 demands are met', () => {
  const match = Match.create('chapter-advance', rules)
  const required = rules.elements.defaultDemandRequired
  match.deliveryByShape = { fire: required, water: required, steam: required }
  match.deliveries = required * 3
  assert.equal(match.chapter, 1)
  assert.equal(match.version, '0.1')
  match.tick()
  assert.equal(match.chapter, 2)
  assert.equal(match.version, '0.2')
})
