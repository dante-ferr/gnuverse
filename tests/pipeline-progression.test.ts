import assert from 'node:assert/strict'
import test from 'node:test'
import {
  chebyshevDistance,
  mooreNeighborChunks,
  pickGrassNeighborChunk,
  pickSatelliteChunkCoords,
  starterChunkCoord,
} from '../game-server/pipeline/world/chunks/coords.ts'
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

test('grass neighbor is a Moore neighbor of the starter', () => {
  const starter = starterChunkCoord(64)
  const satellites = pickSatelliteChunkCoords('grass-ring', starter, 64, 2, 3, 4)
  const grass = pickGrassNeighborChunk('grass-ring', starter, 64, [starter, ...satellites])
  const moore = mooreNeighborChunks(starter).map((c) => `${c.cx},${c.cy}`)
  assert.ok(moore.includes(`${grass.cx},${grass.cy}`))
})

test('Match.create owns starter, satellites, and grass chunk with three cores', () => {
  const match = Match.create('progression-layout', rules)
  assert.equal(match.cores.length, 3)
  assert.equal(match.ownedChunks.length, 4)
  assert.ok(match.grassChunkKey)
  const grassSources = match.sources.filter((source) => source.shape === 'grass')
  assert.ok(
    grassSources.some((source) => match.isOwnedCell(source.origin)),
    'grass source should live in the owned grass neighbor when emitted',
  )
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