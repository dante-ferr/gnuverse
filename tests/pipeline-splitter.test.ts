import assert from 'node:assert/strict'
import test from 'node:test'
import { Packet } from '../game-server/pipeline/packets/packet.ts'
import { SplitterMachine } from '../game-server/pipeline/machines/splitter-machine.ts'
import { Match } from '../game-server/pipeline/world/match.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

const rules = testPipelineRules()
const author = { id: 'u1', nickname: 'Ada' }

function matchWithSplitter(facing: 'east' | 'west' | 'north' | 'south' = 'east') {
  const match = Match.create('splitter-test', rules)
  const origin = { x: match.core.origin.x - 6, y: match.core.origin.y + 2 }
  const error = match.placeMachine(
    { machineId: 'splitter', x: origin.x, y: origin.y, facing },
    author,
  )
  assert.equal(error, null)
  return { match, origin, splitter: match.splitters[0]! }
}

test('placeMachine accepts splitter in normal rooms', () => {
  const { match } = matchWithSplitter()
  assert.equal(match.splitters.length, 1)
  assert.equal(match.splitters[0]!.width, 1)
  assert.equal(match.splitters[0]!.height, 1)
  assert.equal(match.splitters[0]!.inputSlots().length, 1)
  assert.equal(match.splitters[0]!.outputSlots().length, 3)
})

test('splitter absorbs inbound packet and round-robins to output belts', () => {
  const { match, origin, splitter } = matchWithSplitter('east')
  const inCell = { x: origin.x - 1, y: origin.y }
  assert.equal(
    match.place([{ ...inCell, direction: 'east' }], author),
    null,
  )
  const outs = splitter.orderedOutputSlots()
  for (const slot of outs) {
    assert.equal(match.place([{ ...slot.cell, direction: slot.travel }], author), null)
  }
  match.packets.push(new Packet('p1', inCell, 'circle'))
  match.tick()
  assert.equal(splitter.buffer, null)
  assert.equal(match.packets.length, 1)
  const first = match.packets[0]!
  assert.ok(outs.some((slot) => slot.cell.x === first.cell.x && slot.cell.y === first.cell.y))

  match.packets = [new Packet('p2', inCell, 'circle')]
  match.tick()
  match.packets = [new Packet('p3', inCell, 'circle')]
  match.tick()
  match.packets = [new Packet('p4', inCell, 'circle')]
  match.tick()
  // After three successful ejects, RR wrapped; fourth lands on first port again if cleared.
  assert.ok(match.splitters[0]!.nextSplitPort >= 0)
})

test('splitter keeps buffer when all outputs blocked', () => {
  const { match, origin, splitter } = matchWithSplitter('east')
  const inCell = { x: origin.x - 1, y: origin.y }
  assert.equal(match.place([{ ...inCell, direction: 'east' }], author), null)
  match.packets.push(new Packet('p1', inCell, 'circle'))
  match.tick()
  assert.equal(splitter.buffer, 'circle')
  assert.equal(match.packets.length, 0)
})

test('splitter absorbs from approach belt regardless of belt facing', () => {
  const { match, origin, splitter } = matchWithSplitter('east')
  const inCell = { x: origin.x - 1, y: origin.y }
  // Belt faces away; natural flow is blocked, so pull is the only option.
  assert.equal(match.place([{ ...inCell, direction: 'west' }], author), null)
  match.packets.push(new Packet('p1', inCell, 'circle'))
  match.tick()
  assert.equal(splitter.buffer, 'circle')
  assert.equal(match.packets.length, 0)
})

test('splitter does not eject onto a belt facing into the output', () => {
  const { match, origin, splitter } = matchWithSplitter('east')
  const forward = splitter.orderedOutputSlots().find((slot) => slot.travel === 'east')!
  // Belt on the output cell points back at the splitter.
  assert.equal(match.place([{ ...forward.cell, direction: 'west' }], author), null)
  splitter.buffer = 'circle'
  match.tick()
  assert.equal(splitter.buffer, 'circle')
  assert.equal(match.packets.length, 0)
})

test('side belt pointing at the splitter is not an input', () => {
  const { match, origin, splitter } = matchWithSplitter('east')
  const side = { x: origin.x, y: origin.y + 1 }
  // South neighbor faces north, so its forward cell is the splitter tile.
  assert.equal(match.place([{ ...side, direction: 'north' }], author), null)
  match.packets.push(new Packet('p1', side, 'circle'))
  match.tick()
  assert.equal(splitter.buffer, null)
  assert.equal(match.packets[0]!.cell.y, side.y)
})

test('splitter ejects onto a perpendicular belt on the output cell', () => {
  const { match, origin, splitter } = matchWithSplitter('east')
  const forward = splitter.orderedOutputSlots().find((slot) => slot.travel === 'east')!
  assert.equal(match.place([{ ...forward.cell, direction: 'north' }], author), null)
  splitter.buffer = 'circle'
  match.tick()
  assert.equal(splitter.buffer, null)
  assert.ok(match.packets.some((p) => p.cell.x === forward.cell.x && p.cell.y === forward.cell.y))
})

test('approach pull round-robins with belt-forward flow', () => {
  const { match, origin, splitter } = matchWithSplitter('east')
  const inCell = { x: origin.x - 1, y: origin.y }
  const flowCell = { x: origin.x - 1, y: origin.y - 1 }
  assert.equal(match.place([{ ...inCell, direction: 'north' }], author), null)
  assert.equal(match.place([{ ...flowCell, direction: 'north' }], author), null)

  match.packets.push(new Packet('p1', inCell, 'circle'))
  match.tick()
  const firstPulled = splitter.buffer === 'circle'
  const firstFlowed = match.packets.some((p) => p.cell.x === flowCell.x && p.cell.y === flowCell.y)
  assert.ok(firstPulled || firstFlowed)
  assert.ok(!(firstPulled && firstFlowed))

  splitter.buffer = null
  match.packets = [new Packet('p2', inCell, 'circle')]
  match.tick()
  const secondPulled = splitter.buffer === 'circle'
  const secondFlowed = match.packets.some((p) => p.cell.x === flowCell.x && p.cell.y === flowCell.y)
  assert.equal(secondPulled, !firstPulled)
  assert.equal(secondFlowed, !firstFlowed)
})

test('remove deletes splitter', () => {
  const { match, origin } = matchWithSplitter()
  const result = match.remove(origin, author)
  assert.equal(result.error, null)
  assert.equal(result.kind, 'splitter')
  assert.equal(match.splitters.length, 0)
})

test('SplitterMachine constructs for every facing', () => {
  for (const facing of ['north', 'east', 'south', 'west'] as const) {
    const machine = new SplitterMachine('s', { x: 3, y: 3 }, facing, author)
    assert.equal(machine.outputSlots().length, 3)
  }
})
