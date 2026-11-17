import assert from 'node:assert/strict'
import test from 'node:test'
import type { Cell } from '../game-server/pipeline/geometry/cell.ts'
import { ahead, opposite, type Direction } from '../game-server/pipeline/geometry/direction.ts'
import { CoreMachine } from '../game-server/pipeline/machines/core-machine.ts'
import { Packet } from '../game-server/pipeline/packets/packet.ts'
import type { PipelineRules } from '../game-server/pipeline/rules.ts'
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
  colorCore: '#ffffff',
  colorSource: '#52d6c9',
  colorAccent: '#52d6c9',
  colorDecor: '#1a4542',
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
  beltChevronStrokePx: 6,
  beltChevronFlowMs: 900,
  machineClearanceMin: 1,
  coreClearanceExtra: 2,
  coreDemandCircle: 20,
}

const author = { id: 'ada', nickname: 'Ada' }

function directionBetween(from: Cell, to: Cell): Direction {
  if (to.x > from.x) return 'east'
  if (to.x < from.x) return 'west'
  if (to.y > from.y) return 'south'
  return 'north'
}

function manhattanBelts(from: Cell, to: Cell, finalDirection: Direction) {
  const path: Cell[] = [{ ...from }]
  let { x, y } = from
  while (x !== to.x) {
    x += Math.sign(to.x - x)
    path.push({ x, y })
  }
  while (y !== to.y) {
    y += Math.sign(to.y - y)
    path.push({ x, y })
  }
  return path.map((cell, index) => ({
    ...cell,
    direction: index < path.length - 1 ? directionBetween(cell, path[index + 1]!) : finalDirection,
  }))
}

function connected(matchRules: PipelineRules = rules) {
  const match = Match.create('seed', matchRules)
  const output = match.source.outputSlots()[0]!.cell
  const facing = match.source.direction
  const slots = match.core
    .inputSlots()
    .filter((slot) => slot.travel === facing)
  assert.ok(slots.length > 0)
  const target = slots.reduce((best, slot) => {
    const dist =
      Math.abs(slot.cell.x - output.x) + Math.abs(slot.cell.y - output.y)
    const bestDist =
      Math.abs(best.cell.x - output.x) + Math.abs(best.cell.y - output.y)
    return dist < bestDist ? slot : best
  })
  const approach = ahead(target.cell.x, target.cell.y, opposite(facing))
  const cells = manhattanBelts(output, approach, facing)
  assert.equal(match.place(cells, author), null)
  return match
}

test('core exposes three input slots on every face and skips corners', () => {
  const core = new CoreMachine('core', { x: 0, y: 0 })
  assert.equal(core.inputSlots().length, 12)
  assert.equal(core.slotAt({ x: 0, y: 0 }, 'input'), undefined)
  assert.ok(core.slotAt({ x: 2, y: 0 }, 'input'))
  assert.ok(core.slotAt({ x: 0, y: 2 }, 'input'))
})

test('a belt line carries a circle into the facing core slot', () => {
  const match = connected()
  const before = match.deliveries
  for (let i = 0; i < 30; i++) match.tick()
  assert.ok(match.deliveries > before)
  assert.equal(match.packets.every((packet) => packet.shape === 'circle'), true)
})

test('deliveries count per shape and surface on frame demands', () => {
  const match = connected()
  for (let i = 0; i < 30; i++) match.tick()
  const circles = match.deliveryByShape.circle ?? 0
  assert.ok(circles > 0)
  assert.equal(match.deliveries, circles)
  const frame = match.toFrame()
  assert.deepEqual(frame.demands, [{ shape: 'circle', received: circles, required: rules.coreDemandCircle }])
})

test('core stops accepting a shape once its requirement is met', () => {
  const match = connected({ ...rules, coreDemandCircle: 1 })
  for (let i = 0; i < 40; i++) match.tick()
  assert.equal(match.deliveryByShape.circle, 1)
  assert.equal(match.deliveries, 1)
  assert.ok(match.packets.length > 0, 'overflow circles should stay on belts')
  for (let i = 0; i < 8; i++) match.tick()
  assert.equal(match.deliveryByShape.circle, 1)
  assert.equal(match.deliveries, 1)
  const beltCells = new Set(match.belts.map((belt) => `${belt.origin.x},${belt.origin.y}`))
  const onBelts = match.packets.filter((packet) => beltCells.has(`${packet.cell.x},${packet.cell.y}`))
  assert.equal(onBelts.length, match.packets.length)
  const occupied = new Set(onBelts.map((packet) => `${packet.cell.x},${packet.cell.y}`))
  assert.equal(occupied.size, onBelts.length, 'each belt cell holds at most one packet')
  assert.ok(onBelts.length > 1, 'the line backs up instead of collapsing onto the core')
})

test('two packets do not swap and a blocked belt holds its packet', () => {
  const match = Match.create('seed', rules)
  const y = 2
  assert.equal(
    match.place(
      [
        { x: 1, y, direction: 'east' },
        { x: 2, y, direction: 'west' },
      ],
      author,
    ),
    null,
  )
  match.packets.push(new Packet('a', { x: 1, y }), new Packet('b', { x: 2, y }))
  match.tick()
  const cells = match.packets.map((packet) => `${packet.id}:${packet.cell.x}`).sort()
  assert.deepEqual(cells, ['a:1', 'b:2'])
})

test('the oldest belt is recycled past the tile cap', () => {
  const match = Match.create('seed', { ...rules, tileCap: 2 })
  const y = 1
  assert.equal(
    match.place(
      [
        { x: 0, y, direction: 'east' },
        { x: 1, y, direction: 'east' },
        { x: 2, y, direction: 'east' },
      ],
      author,
    ),
    null,
  )
  assert.equal(match.belts.length, 2)
  assert.equal(match.beltAt({ x: 0, y }), undefined)
  assert.ok(match.beltAt({ x: 2, y }))
})

test('a signed placement cannot cover the core', () => {
  const match = Match.create('seed', rules)
  const cell = match.core.inputSlots()[0].cell
  assert.match(
    match.place([{ ...cell, direction: 'east' }], author) ?? '',
    /máquina/,
  )
})