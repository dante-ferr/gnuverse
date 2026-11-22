import assert from 'node:assert/strict'
import test from 'node:test'
import { ahead, opposite, type Direction } from '../game-server/pipeline/geometry/direction.ts'
import { BeltMachine } from '../game-server/pipeline/machines/belt-machine.ts'
import { CombinerMachine } from '../game-server/pipeline/machines/combiner-machine.ts'
import { Packet } from '../game-server/pipeline/packets/packet.ts'
import { Match } from '../game-server/pipeline/world/match.ts'
import { approachCellForInput } from '../game-server/pipeline/world/chunks/sandbox-layout.ts'
import { craftTicksForRecipe } from '../game-server/pipeline/elements/rate.ts'
import { matchRecipeFromBuffer } from '../game-server/pipeline/world/tick/craft.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

const rules = testPipelineRules()
const author = { id: 'ada', nickname: 'Ada' }

function beltAt(
  match: Match,
  cell: { x: number; y: number },
  direction: Direction,
) {
  match.belts.push(
    new BeltMachine(`b${match.nextBeltSeq++}`, cell, direction, {
      id: author.id,
      nickname: author.nickname,
      placedAt: match.nextBeltSeq,
    }),
  )
}

function sandboxWithCombiner(machineId: 'combiner_2' | 'combiner_3' = 'combiner_2', facing: Direction = 'east') {
  const match = Match.createSandbox('combiner', rules)
  const combiner = new CombinerMachine('c1', machineId, { x: 25, y: 24 }, facing)
  match.combiners.push(combiner)
  return { match, combiner }
}

test('combiner absorbs recipe inputs on input slots', () => {
  const { match, combiner } = sandboxWithCombiner()
  const waterSlot = combiner.inputSlots()[0]!
  const approach = ahead(waterSlot.cell.x, waterSlot.cell.y, opposite(waterSlot.travel))
  beltAt(match, approach, waterSlot.travel)
  match.packets.push(new Packet('pw', { ...approach }, 'water'))
  const before = match.packets.length
  match.tick()
  assert.equal(match.packets.length, before - 1)
  assert.equal(combiner.buffer.water, 1)
})

test('combiner crafts steam after rate-based craft ticks when inputs are buffered', () => {
  const { match, combiner } = sandboxWithCombiner()
  combiner.buffer = { water: 1, fire: 1 }
  const out = combiner.orderedOutputSlots()[0]!
  beltAt(match, out.cell, out.travel)
  const steamRecipe = rules.elements.elements.find((el) => el.id === 'steam')!
  const ticks = craftTicksForRecipe(rules.elements, rules.tickMs, steamRecipe)
  combiner.activeRecipeId = 'steam'
  combiner.craftRemaining = ticks - 1
  for (let i = 0; i < ticks; i++) match.tick()
  const steam = match.packets.find((packet) => packet.shape === 'steam')
  assert.ok(steam)
})

test('combiner ejects into a tunnel entrance plugged on the output cell', () => {
  const { match, combiner } = sandboxWithCombiner()
  const out = combiner.orderedOutputSlots()[0]!
  const entrance = { ...out.cell }
  const exit = { x: entrance.x + 2, y: entrance.y }
  assert.equal(
    match.placeMachine(
      {
        machineId: 'tunnel',
        entranceX: entrance.x,
        entranceY: entrance.y,
        exitX: exit.x,
        exitY: exit.y,
        facing: out.travel,
      },
      author,
    ),
    null,
  )
  const outBelt = { x: exit.x + 1, y: exit.y }
  beltAt(match, outBelt, out.travel)
  combiner.activeRecipeId = 'steam'
  combiner.pendingOutputs = ['steam']
  match.tick()
  assert.equal(combiner.pendingOutputs, null)
  const entrancePortal = match.tunnels.find((portal) => portal.role === 'entrance')!
  const inTransit =
    entrancePortal.pendingIngress === 'steam' ||
    entrancePortal.queue.some((slot) => slot === 'steam') ||
    entrancePortal.pendingEgress === 'steam' ||
    match.packets.some(
      (packet) =>
        packet.shape === 'steam' && packet.cell.x === outBelt.x && packet.cell.y === outBelt.y,
    )
  assert.ok(inTransit)
})

test('dual-output craft ejects coupled or blocks when one port is full', () => {
  const match = Match.createSandbox('dual', rules)
  const combiner = new CombinerMachine('c1', 'combiner_3', { x: 25, y: 24 }, 'east')
  match.combiners.push(combiner)
  combiner.activeRecipeId = 'kiln'
  combiner.pendingOutputs = ['kiln', 'brick']
  const outputs = combiner.orderedOutputSlots()
  for (const slot of outputs) {
    beltAt(match, slot.cell, slot.travel)
  }
  match.tick()
  assert.equal(match.packets.length, 2)
  assert.equal(combiner.pendingOutputs, null)

  combiner.activeRecipeId = 'kiln'
  combiner.pendingOutputs = ['kiln', 'brick']
  match.packets.push(new Packet('block', { ...outputs[0]!.cell }, 'kiln'))
  match.tick()
  assert.equal(combiner.pendingOutputs?.length, 2)
  assert.equal(match.packets.length, 3)
})

test('combiner_2 exposes one output port', () => {
  const combiner = new CombinerMachine('c', 'combiner_2', { x: 5, y: 5 }, 'east')
  assert.equal(combiner.inputSlots().length, 2)
  assert.equal(combiner.outputSlots().length, 1)
})

test('combiner_3 single-output alternates between output ports when both belts exist', () => {
  const match = Match.createSandbox('split', rules)
  const combiner = new CombinerMachine('c1', 'combiner_3', { x: 25, y: 24 }, 'east')
  match.combiners.push(combiner)
  const outputs = combiner.orderedOutputSlots()
  assert.equal(outputs.length, 2)
  for (const slot of outputs) {
    beltAt(match, slot.cell, slot.travel)
  }
  combiner.activeRecipeId = 'crystal'
  combiner.pendingOutputs = ['crystal']
  match.tick()
  const firstPort = combiner.nextSplitPort === 1 ? 1 : 0
  const first = outputs[firstPort === 0 ? 1 : 0]!.cell
  assert.ok(match.packets.some((packet) => packet.shape === 'crystal' && packet.cell.x === first.x))

  combiner.activeRecipeId = 'crystal'
  combiner.pendingOutputs = ['crystal']
  match.tick()
  const second = outputs[firstPort]!.cell
  assert.ok(match.packets.some((packet) => packet.shape === 'crystal' && packet.cell.x === second.x))
})

test('placeMachine accepts combiner in a normal room', () => {
  const match = Match.create('combiner-normal', rules)
  const origin = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const error = match.placeMachine(
    { machineId: 'combiner_2', x: origin.x, y: origin.y, facing: 'east' },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.sandbox, false)
  assert.equal(match.combiners.length, 1)
})

test('placeMachine accepts combiner footprint in owned sandbox cells', () => {
  const match = Match.createSandbox('place', rules)
  const error = match.placeMachine(
    { machineId: 'combiner_2', x: 25, y: 24, facing: 'east' },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.combiners.length, 1)
  assert.equal(match.combiners[0]!.activeRecipeId, null)
})

test('placeMachine rejects body on another combiner input approach', () => {
  const match = Match.createSandbox('port-approach', rules)
  // Facing south: inputs on the north rim; approach is one cell further north.
  assert.equal(
    match.placeMachine({ machineId: 'combiner_2', x: 25, y: 28, facing: 'south' }, author),
    null,
  )
  const first = match.combiners[0]!
  const approach = approachCellForInput(first)
  // Place a second 3×3 so its south-west cell covers that approach (screenshot case).
  const error = match.placeMachine(
    {
      machineId: 'combiner_2',
      x: approach.x,
      y: approach.y - 2,
      facing: 'south',
    },
    author,
  )
  assert.equal(error, 'Entradas ou saídas sobrepõem outra estrutura.')
  assert.equal(match.combiners.length, 1)
})

test('matchRecipeFromBuffer resolves steam when water and fire are buffered', () => {
  const combiner = new CombinerMachine('c', 'combiner_2', { x: 5, y: 5 }, 'east')
  combiner.buffer = { water: 1, fire: 1 }
  const recipe = matchRecipeFromBuffer(rules, combiner)
  assert.equal(recipe?.id, 'steam')
})

test('remove deletes combiners and refuses cores and sources', () => {
  const match = Match.createSandbox('remove', rules)
  assert.equal(
    match.placeMachine(
      { machineId: 'combiner_2', x: 25, y: 24, facing: 'east' },
      author,
    ),
    null,
  )
  const combiner = match.combiners[0]!
  const removed = match.remove(combiner.origin, author)
  assert.equal(removed.error, null)
  assert.equal(removed.kind, 'combiner')
  assert.equal(match.combiners.length, 0)

  const coreBlock = match.remove(match.cores[0]!.origin, author)
  assert.match(coreBlock.error ?? '', /núcleo/)
  const sourceBlock = match.remove(match.sources[0]!.origin, author)
  assert.match(sourceBlock.error ?? '', /fontes/)
})

test('approachCellForInput is one step outside the combiner input travel', () => {
  const combiner = new CombinerMachine('c', 'combiner_2', { x: 5, y: 5 }, 'east')
  const slot = combiner.inputSlots()[0]!
  const approach = approachCellForInput(combiner)
  const expected = ahead(slot.cell.x, slot.cell.y, opposite(slot.travel))
  assert.equal(approach.x, expected.x)
  assert.equal(approach.y, expected.y)
})

test('CombinerMachine constructs valid slots for every facing', () => {
  const facings = ['east', 'south', 'west', 'north'] as const
  for (const facing of facings) {
    assert.doesNotThrow(
      () => new CombinerMachine('c2', 'combiner_2', { x: 10, y: 10 }, facing),
    )
    assert.doesNotThrow(
      () => new CombinerMachine('c3', 'combiner_3', { x: 10, y: 10 }, facing),
    )
    const c3 = new CombinerMachine('c3b', 'combiner_3', { x: 10, y: 10 }, facing)
    const size = CombinerMachine.sizeFor('combiner_3', facing)
    assert.equal(c3.width, size.width)
    assert.equal(c3.height, size.height)
    assert.equal(c3.facing, facing)
    assert.equal(c3.inputSlots().length, 3)
    assert.equal(c3.outputSlots().length, 2)
  }
})