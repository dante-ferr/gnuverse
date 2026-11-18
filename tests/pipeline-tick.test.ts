import assert from 'node:assert/strict'
import test from 'node:test'
import type { Cell } from '../game-server/pipeline/geometry/cell.ts'
import { ahead, opposite, type Direction } from '../game-server/pipeline/geometry/direction.ts'
import { CoreMachine } from '../game-server/pipeline/machines/core-machine.ts'
import { Packet } from '../game-server/pipeline/packets/packet.ts'
import type { PipelineRules } from '../game-server/pipeline/rules.ts'
import { Match } from '../game-server/pipeline/world/match.ts'
import { forceAdvance } from '../game-server/pipeline/world/unlock.ts'

const rules: PipelineRules = {
  tickMs: 250,
  gridWidth: 24,
  gridHeight: 24,
  sourcePeriodTicks: 4,
  colorBackground: '#0e171d',
  colorGrid: '#23343c',
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
  beltChevronStrokePx: 6,
  beltChevronFlowMs: 900,
  machineClearanceMin: 1,
  coreClearanceExtra: 2,
  coreDemandCircle: 20,
  chunkSize: 24,
  mapChunkExtent: 64,
  chunkCostBase: 5,
  chunkCostGrowth: 2,
  chunkPreviewRing: 1,
  slotInputDepthPercent: 22,
  slotOutputDepthPercent: 34,
  slotBracketThickPercent: 18,
  slotFlowMarkDepthPercent: 12,
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

test('two belts feeding one free cell admit exactly one packet', () => {
  const match = Match.create('seed', rules)
  const y = 2
  const mid = 2
  assert.equal(
    match.place(
      [
        { x: 1, y, direction: 'east' },
        { x: 3, y, direction: 'west' },
        { x: mid, y, direction: 'north' },
      ],
      author,
    ),
    null,
  )
  match.packets.push(new Packet('a', { x: 1, y }), new Packet('b', { x: 3, y }))
  match.tick()
  const atJunction = match.packets.filter((packet) => packet.cell.x === mid && packet.cell.y === y)
  const stillWaiting = match.packets.filter(
    (packet) => (packet.cell.x === 1 || packet.cell.x === 3) && packet.cell.y === y,
  )
  assert.equal(atJunction.length, 1)
  assert.equal(atJunction[0]!.id, 'b')
  assert.equal(stillWaiting.length, 1)
  assert.equal(stillWaiting[0]!.id, 'a')
})

test('merge round-robin alternates equally between two inputs', () => {
  const match = Match.create('seed', rules)
  const y = 2
  const mid = 2
  assert.equal(
    match.place(
      [
        { x: 1, y, direction: 'east' },
        { x: 3, y, direction: 'west' },
        { x: mid, y, direction: 'north' },
        { x: mid, y: y - 1, direction: 'north' },
      ],
      author,
    ),
    null,
  )
  const winners: string[] = []
  for (let i = 0; i < 4; i++) {
    match.packets = [new Packet('a', { x: 1, y }), new Packet('b', { x: 3, y })]
    match.tick()
    const atJunction = match.packets.find((packet) => packet.cell.x === mid && packet.cell.y === y)
    assert.ok(atJunction)
    winners.push(atJunction.id)
  }
  assert.deepEqual(winners, ['b', 'a', 'b', 'a'])
})

test('three-input merge round-robins NESW and rejects a fourth inbound', () => {
  const match = Match.create('seed', rules)
  const y = 5
  const mid = 5
  assert.equal(
    match.place(
      [
        { x: mid, y: y - 1, direction: 'south' },
        { x: mid + 1, y, direction: 'west' },
        { x: mid - 1, y, direction: 'east' },
        { x: mid, y, direction: 'south' },
        { x: mid, y: y + 1, direction: 'south' },
      ],
      author,
    ),
    null,
  )
  assert.match(
    match.place([{ x: mid, y: y + 1, direction: 'north' }], author) ?? '',
    /3 esteiras/,
  )

  const winners: string[] = []
  for (let i = 0; i < 6; i++) {
    match.packets = [
      new Packet('n', { x: mid, y: y - 1 }),
      new Packet('e', { x: mid + 1, y }),
      new Packet('w', { x: mid - 1, y }),
    ]
    match.tick()
    const atJunction = match.packets.find((packet) => packet.cell.x === mid && packet.cell.y === y)
    assert.ok(atJunction)
    winners.push(atJunction.id)
  }
  assert.deepEqual(winners, ['n', 'e', 'w', 'n', 'e', 'w'])
})

test('a merge follows an occupant that clears the junction in the same tick', () => {
  const match = Match.create('seed', rules)
  const y = 2
  const mid = 2
  assert.equal(
    match.place(
      [
        { x: 1, y, direction: 'east' },
        { x: 3, y, direction: 'west' },
        { x: mid, y, direction: 'north' },
        { x: mid, y: y - 1, direction: 'north' },
      ],
      author,
    ),
    null,
  )
  match.packets.push(
    new Packet('a', { x: 1, y }),
    new Packet('b', { x: 3, y }),
    new Packet('c', { x: mid, y }),
  )
  match.tick()
  assert.deepEqual(
    match.packets
      .map((packet) => `${packet.id}:${packet.cell.x},${packet.cell.y}`)
      .sort(),
    ['a:1,2', 'b:2,2', 'c:2,1'],
  )
})

test('all belts in a stroke are kept without a per-player cap', () => {
  const match = Match.create('seed', rules)
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
  assert.equal(match.belts.length, 3)
  assert.ok(match.beltAt({ x: 0, y }))
  assert.ok(match.beltAt({ x: 2, y }))
})

test('auto unlock bumps 0.1 to 0.2 when delivery milestones are met', () => {
  const match = connected({ ...rules, coreDemandCircle: 3 })
  match.deliveryByShape = { circle: 3 }
  match.deliveries = 3
  assert.equal(match.version, '0.1')
  match.tick()
  assert.equal(match.version, '0.2')
  match.tick()
  assert.equal(match.version, '0.2')
})

test('forceAdvance can bump beyond 0.2', () => {
  const match = Match.create('seed', rules)
  match.version = '0.2'
  forceAdvance(match)
  assert.equal(match.version, '0.3')
})

test('a signed placement cannot cover the core', () => {
  const match = Match.create('seed', rules)
  const cell = match.core.inputSlots()[0].cell
  assert.match(
    match.place([{ ...cell, direction: 'east' }], author) ?? '',
    /máquina/,
  )
})

test('a stroke skips machine cells and keeps the rest', () => {
  const match = Match.create('seed', rules)
  const free = { x: match.core.origin.x - 1, y: match.core.origin.y + 2 }
  const onCore = { x: match.core.origin.x, y: match.core.origin.y + 2 }
  assert.ok(!match.core.covers(free))
  assert.ok(match.core.covers(onCore))
  assert.equal(
    match.place(
      [
        { ...free, direction: 'east' },
        { ...onCore, direction: 'east' },
      ],
      author,
    ),
    null,
  )
  assert.ok(match.beltAt(free))
  assert.equal(match.beltAt(onCore), undefined)
  assert.equal(match.belts.length, 1)
})