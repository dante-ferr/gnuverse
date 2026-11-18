import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearanceDepths,
  freeRect,
  portCountsBySide,
  rectsOverlap,
} from '../game-server/pipeline/geometry/clearance.ts'
import { CoreMachine } from '../game-server/pipeline/machines/core-machine.ts'
import { SourceMachine } from '../game-server/pipeline/machines/source-machine.ts'
import type { PipelineRules } from '../game-server/pipeline/rules.ts'
import type { Direction } from '../game-server/pipeline/geometry/direction.ts'
import { layoutTwoStarterSources } from '../game-server/pipeline/world/placement/approach.ts'
import {
  bodyGapAlongApproach,
  expectedBodyGap,
} from '../game-server/pipeline/world/placement/gaps.ts'
import { Match } from '../game-server/pipeline/world/match.ts'

const rules: PipelineRules = {
  tickMs: 250,
  gridWidth: 24,
  gridHeight: 24,
  sourcePeriodTicks: 4,
  colorBackground: '#0e171d',
  colorGrid: '#23343c',
  gridVisibleMinZoom: 1,
  cameraZoomMin: 0.08,
  cameraZoomMax: 3,
  colorBelt: '#9eb0b7',
  colorBeltChevron: '#6b7d87',
  colorPacket: '#52d6c9',
  colorCore: '#ffffff',
  colorSource: '#52d6c9',
  colorAccent: '#52d6c9',
  colorDecor: '#1a4542',
  decorDarkenPercent: 35,
  outlineWidthPx: 3,
  colorOutline: '#0a1014',
  colorSurface: '#17252c',
  colorMuted: '#6a7b83',
  colorHighlight: '#86e7dd',
  colorWarning: '#ff8b7d',
  colorSuccess: '#5ed4b0',
  colorInk: '#293c45',
  decorStrokeWidth: 28,
  resourceGlyphSizePx: 28,
  resourceGlyphOrbitPx: 4,
  resourceGlyphOrbitMs: 4000,
  beltChevronStrokePx: 4,
  beltChevronFlowMs: 900,
  machineClearanceMin: 1,
  coreClearanceExtra: 2,
  coreDemandCircle: 20,
  chunkSize: 24,
  mapChunkExtent: 64,
  chunkCostBase: 5,
  chunkCostStep: 2,
  sourceSpawnChanceCirclePercent: 0,
  sourceSpawnChanceFirePercent: 0,
  sourceSpawnChanceWaterPercent: 0,
  slotInputDepthPercent: 22,
  slotOutputDepthPercent: 34,
  slotBracketThickPercent: 18,
  slotFlowMarkDepthPercent: 12,
}

const author = { id: 'ada', nickname: 'Ada' }

function coreInChunkFor(rules: PipelineRules) {
  const chunkSize = rules.chunkSize
  return {
    x: Math.floor((chunkSize - CoreMachine.size) / 2),
    y: Math.floor((chunkSize - CoreMachine.size) / 2),
  }
}

test('core clearance depths are port counts plus core extra on every side', () => {
  const core = new CoreMachine('core', { x: 0, y: 0 })
  const ports = portCountsBySide(core)
  assert.deepEqual(ports, { north: 3, east: 3, south: 3, west: 3 })
  const depths = clearanceDepths(ports, 1, 2)
  assert.deepEqual(depths, { north: 5, east: 5, south: 5, west: 5 })
})

test('east-facing source has depth 1 on every side', () => {
  const source = new SourceMachine('source', { x: 0, y: 0 }, 'east', 'circle', 4)
  const ports = portCountsBySide(source)
  assert.deepEqual(ports, { north: 0, east: 1, south: 0, west: 0 })
  const depths = clearanceDepths(ports, 1)
  assert.deepEqual(depths, { north: 1, east: 1, south: 1, west: 1 })
})

test('freeRect expands the footprint by depths on all sides including corners', () => {
  const depths = { north: 2, east: 3, south: 4, west: 5 }
  const rect = freeRect({ x: 10, y: 20 }, 5, 5, depths)
  assert.deepEqual(rect, { x0: 5, y0: 18, x1: 17, y1: 28 })
  assert.equal(rect.x1 - rect.x0 + 1, 5 + depths.west + depths.east)
  assert.equal(rect.y1 - rect.y0 + 1, 5 + depths.north + depths.south)
})

function assertSourceApproachGap(
  coreOrigin: { x: number; y: number },
  sourceOrigin: { x: number; y: number },
  sourceDirection: Direction,
) {
  const core = new CoreMachine('core', coreOrigin)
  const source = new SourceMachine(
    'source',
    sourceOrigin,
    sourceDirection,
    'circle',
    rules.sourcePeriodTicks,
  )
  const coreDepths = clearanceDepths(
    portCountsBySide(core),
    rules.machineClearanceMin,
    rules.coreClearanceExtra,
  )
  const sourceDepths = clearanceDepths(portCountsBySide(source), rules.machineClearanceMin)
  const gap = bodyGapAlongApproach(coreOrigin, sourceOrigin, sourceDirection, sourceDepths, coreDepths)
  assert.equal(gap, expectedBodyGap(sourceDirection, sourceDepths, coreDepths))

  const coreFree = freeRect(core.origin, core.width, core.height, coreDepths)
  const sourceFree = freeRect(source.origin, source.width, source.height, sourceDepths)
  assert.equal(rectsOverlap(coreFree, sourceFree), false)
}

test('layoutTwoStarterSources centers core in chunk and separates sources by clearance', () => {
  const coreInChunk = coreInChunkFor(rules)
  assert.deepEqual(coreInChunk, { x: 9, y: 9 })
  const [fire, water] = layoutTwoStarterSources(rules, 'any-seed', coreInChunk, rules.chunkSize)
  assertSourceApproachGap(coreInChunk, fire.origin, fire.direction)
  assertSourceApproachGap(coreInChunk, water.origin, water.direction)
})

test('same seed yields identical two-source layout', () => {
  const coreInChunk = coreInChunkFor(rules)
  const a = layoutTwoStarterSources(rules, 'room-7f3a', coreInChunk, rules.chunkSize)
  const b = layoutTwoStarterSources(rules, 'room-7f3a', coreInChunk, rules.chunkSize)
  assert.deepEqual(a, b)
})

test('different seeds can pick different placements', () => {
  const coreInChunk = coreInChunkFor(rules)
  const seeds = [
    'seed',
    'room-7f3a',
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    '00000000-1111-2222-3333-444444444444',
    'torre-demo-1',
    'torre-demo-2',
    'north-pick',
    'south-pick',
  ]
  const layouts = seeds.map((seed) => layoutTwoStarterSources(rules, seed, coreInChunk, rules.chunkSize))
  const keys = new Set(
    layouts.map(([fire, water]) =>
      `${fire.direction}:${fire.origin.x},${fire.origin.y}|${water.direction}:${water.origin.x},${water.origin.y}`,
    ),
  )
  assert.ok(keys.size >= 2, `expected varied layouts, saw ${[...keys].join('; ')}`)
})

test('port-only clearance extra 0 yields body gap 4 on default rules size', () => {
  const tight: PipelineRules = { ...rules, coreClearanceExtra: 0 }
  const coreInChunk = coreInChunkFor(tight)
  const [fire] = layoutTwoStarterSources(tight, 'gap-four', coreInChunk, tight.chunkSize)
  const core = new CoreMachine('core', coreInChunk)
  const source = new SourceMachine(
    'source',
    fire.origin,
    fire.direction,
    'circle',
    tight.sourcePeriodTicks,
  )
  const coreDepths = clearanceDepths(
    portCountsBySide(core),
    tight.machineClearanceMin,
    tight.coreClearanceExtra,
  )
  const sourceDepths = clearanceDepths(portCountsBySide(source), tight.machineClearanceMin)
  const gap = bodyGapAlongApproach(
    coreInChunk,
    fire.origin,
    fire.direction,
    sourceDepths,
    coreDepths,
  )
  assert.equal(gap, 4)
})

test('Match.create respects clearance layout and allows belts in free-area cells', () => {
  const match = Match.create('seed', rules)
  const fire = match.sources.find((source) => match.sourceRoles[source.id] === 'fire')
  assert.ok(fire)
  assertSourceApproachGap(match.core.origin, fire!.origin, fire!.direction)

  const westPad = { x: match.core.origin.x - 1, y: match.core.origin.y + 2 }
  assert.ok(!match.core.covers(westPad))
  assert.ok(match.isOwnedCell(westPad))
  assert.equal(match.place([{ ...westPad, direction: 'east' }], author), null)
})