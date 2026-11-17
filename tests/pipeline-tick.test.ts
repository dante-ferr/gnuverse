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
  colorCore: '#edf4f4',
  colorSource: '#edf4f4',
  colorAccent: '#52d6c9',
  decorStrokeWidth: 28,
  machineClearanceMin: 1,
  coreClearanceExtra: 2,
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

function connected() {
  const match = Match.create('seed', rules)
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