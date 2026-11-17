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
import {
  bodyGapAlongApproach,
  expectedBodyGap,
  layoutInitialMachines,
} from '../game-server/pipeline/world/map-layout.ts'
import { Match } from '../game-server/pipeline/world/match.ts'

const rules: PipelineRules = {
  tickMs: 250,
  gridWidth: 24,
  gridHeight: 24,
  tileCap: 25,
  sourcePeriodTicks: 4,
  colorBackground: '#0e171d',
  colorGrid: '#23343c',
  colorBelt: '#9eb0b7',
  colorPacket: '#52d6c9',
  colorCore: '#edf4f4',
  colorSource: '#edf4f4',
  colorAccent: '#52d6c9',
  decorStrokeWidth: 28,
  machineClearanceMin: 1,
  coreClearanceExtra: 2,
}

const author = { id: 'ada', nickname: 'Ada' }

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

function assertClearanceGap(layout: ReturnType<typeof layoutInitialMachines>) {
  assert.deepEqual(layout.coreOrigin, { x: 9, y: 9 })

  const core = new CoreMachine('core', layout.coreOrigin)
  const source = new SourceMachine(
    'source',
    layout.sourceOrigin,
    layout.sourceDirection,
    'circle',
    rules.sourcePeriodTicks,
  )
  const coreDepths = clearanceDepths(
    portCountsBySide(core),
    rules.machineClearanceMin,
    rules.coreClearanceExtra,
  )
  const sourceDepths = clearanceDepths(portCountsBySide(source), rules.machineClearanceMin)
  const gap = bodyGapAlongApproach(
    layout.coreOrigin,
    layout.sourceOrigin,
    layout.sourceDirection,
    sourceDepths,
    coreDepths,
  )
  assert.equal(gap, expectedBodyGap(layout.sourceDirection, sourceDepths, coreDepths))
  assert.equal(gap, 6)

  const coreFree = freeRect(core.origin, core.width, core.height, coreDepths)
  const sourceFree = freeRect(source.origin, source.width, source.height, sourceDepths)
  assert.equal(rectsOverlap(coreFree, sourceFree), false)
}

test('layoutInitialMachines on 24×24 centers core and separates source by clearance gap', () => {
  assertClearanceGap(layoutInitialMachines(rules, 'any-seed'))
})

test('same seed yields identical layout', () => {
  const a = layoutInitialMachines(rules, 'room-7f3a')
  const b = layoutInitialMachines(rules, 'room-7f3a')
  assert.deepEqual(a, b)
})

test('different seeds can pick different placements', () => {
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
  const layouts = seeds.map((seed) => layoutInitialMachines(rules, seed))
  const keys = new Set(
    layouts.map(
      (layout) =>
        `${layout.sourceDirection}:${layout.sourceOrigin.x},${layout.sourceOrigin.y}`,
    ),
  )
  assert.ok(keys.size >= 2, `expected varied layouts, saw ${[...keys].join('; ')}`)
})

test('port-only clearance extra 0 yields body gap 4 on default rules size', () => {
  const tight: PipelineRules = { ...rules, coreClearanceExtra: 0 }
  const layout = layoutInitialMachines(tight, 'gap-four')
  const core = new CoreMachine('core', layout.coreOrigin)
  const source = new SourceMachine(
    'source',
    layout.sourceOrigin,
    layout.sourceDirection,
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
    layout.coreOrigin,
    layout.sourceOrigin,
    layout.sourceDirection,
    sourceDepths,
    coreDepths,
  )
  assert.equal(gap, 4)
})

test('Match.create respects clearance layout and allows belts in free-area cells', () => {
  const match = Match.create('seed', rules)
  assertClearanceGap({
    coreOrigin: match.core.origin,
    sourceOrigin: match.source.origin,
    sourceDirection: match.source.direction,
  })

  const westPad = { x: match.core.origin.x - 1, y: match.core.origin.y + 2 }
  assert.ok(!match.core.covers(westPad))
  assert.equal(match.place([{ ...westPad, direction: 'east' }], author), null)
})