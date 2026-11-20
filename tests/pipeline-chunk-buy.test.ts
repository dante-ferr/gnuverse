import assert from 'node:assert/strict'
import test from 'node:test'
import { BeltMachine } from '../game-server/pipeline/machines/belt-machine.ts'
import { CombinerMachine } from '../game-server/pipeline/machines/combiner-machine.ts'
import { SplitterMachine } from '../game-server/pipeline/machines/splitter-machine.ts'
import { TunnelPortalMachine } from '../game-server/pipeline/machines/tunnel-machine.ts'
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

test('buyPreviewChunk shifts placed logistics once when the origin moves', () => {
  const rules = testPipelineRules({ chunkSize: 24, mapChunkExtent: 64 })
  const match = Match.create('chunk-buy-logistics', rules)
  const edge = match.previewChunks.find((coord) => coord.cx === match.originChunk.cx)
  assert.ok(edge, 'expected a preview on the west edge of the visible map')

  const anchor = { x: match.core.origin.x + 6, y: match.core.origin.y }
  assert.ok(match.isOwnedCell(anchor))
  const author = { id: 'a', nickname: 'a' }
  const belt = new BeltMachine('belt-1', { ...anchor }, 'east', { ...author, placedAt: 1 })
  const splitter = new SplitterMachine(
    'split-1',
    { x: anchor.x, y: anchor.y + 2 },
    'east',
    author,
  )
  const entrance = new TunnelPortalMachine(
    'tun-in',
    { x: anchor.x, y: anchor.y + 4 },
    'entrance',
    'pair',
    'east',
    author,
    2,
  )
  const exit = new TunnelPortalMachine(
    'tun-out',
    { x: anchor.x + 3, y: anchor.y + 4 },
    'exit',
    'pair',
    'east',
    author,
  )
  const combiner = new CombinerMachine(
    'comb-1',
    'combiner_2',
    { x: anchor.x, y: anchor.y + 6 },
    'east',
  )
  match.belts.push(belt)
  match.splitters.push(splitter)
  match.tunnels.push(entrance, exit)
  match.combiners.push(combiner)
  assert.equal(belt.slots[0]!.cell, belt.origin)
  assert.equal(splitter.slots[0]!.cell, splitter.origin)
  assert.equal(entrance.slots[0]!.cell, entrance.origin)

  const before = [belt, splitter, entrance, exit, combiner].map((machine) => ({
    ...machine.origin,
  }))
  const originBefore = { ...match.originChunk }
  assert.equal(buyPreviewChunk(match, edge), null)
  const dx = (originBefore.cx - match.originChunk.cx) * rules.chunkSize
  const dy = (originBefore.cy - match.originChunk.cy) * rules.chunkSize
  assert.ok(dx !== 0 || dy !== 0)

  for (const [index, machine] of [belt, splitter, entrance, exit, combiner].entries()) {
    assert.equal(machine.origin.x, before[index]!.x + dx)
    assert.equal(machine.origin.y, before[index]!.y + dy)
    assert.ok(match.isOwnedCell(machine.origin))
  }
  assert.equal(belt.slots[0]!.cell.x, belt.origin.x)
  assert.equal(belt.outputSlots()[0]!.cell.x, belt.origin.x + 1)
  assert.equal(exit.origin.x - entrance.origin.x, 3)
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