import assert from 'node:assert/strict'
import test from 'node:test'
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
  colorBackground: '#f4f1ea',
  colorGrid: '#d9d3c5',
  colorBelt: '#2c3330',
  colorPacket: '#1f6f5b',
  colorCore: '#243028',
  colorSource: '#243028',
}

const author = { id: 'ada', nickname: 'Ada' }

function connected() {
  const match = Match.create('seed', rules)
  const output = match.source.outputSlots()[0]!.cell
  const cells = []
  for (let x = output.x; x < match.core.origin.x; x++)
    cells.push({ x, y: output.y, direction: 'east' as const })
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
  for (let i = 0; i < 12; i++) match.tick()
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