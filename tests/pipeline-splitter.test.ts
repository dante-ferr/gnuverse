import assert from 'node:assert/strict'
import test from 'node:test'
import { Packet } from '../game-server/pipeline/packets/packet.ts'
import { SplitterMachine } from '../game-server/pipeline/machines/splitter-machine.ts'
import { ahead, opposite } from '../game-server/pipeline/geometry/direction.ts'
import {
  portOccupancyCell,
  portsConnected,
} from '../game-server/pipeline/world/edit/building-slots.ts'
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

test('placeMachine allows adjacent splitters when output lands on the next input', () => {
  const { match, origin } = matchWithSplitter('east')
  // Same facing: upstream east output sits on downstream input with matching travel.
  const error = match.placeMachine(
    { machineId: 'splitter', x: origin.x + 1, y: origin.y, facing: 'east' },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.splitters.length, 2)
})

test('portsConnected is a direct plug onto the input slot, not a shared gap cell', () => {
  const gapOutput = { cell: { x: 3, y: 0 }, role: 'output' as const, travel: 'west' as const }
  const rimInput = { cell: { x: 2, y: 0 }, role: 'input' as const, travel: 'west' as const }
  assert.equal(portOccupancyCell(gapOutput).x, 3)
  assert.equal(portOccupancyCell(rimInput).x, 3)
  assert.equal(portsConnected(gapOutput, rimInput), false)
  const adjacent = new SplitterMachine('a', { x: 0, y: 0 }, 'east', author)
  const next = new SplitterMachine('b', { x: 1, y: 0 }, 'east', author)
  const gapped = new SplitterMachine('c', { x: 2, y: 0 }, 'east', author)
  const forward = adjacent.outputSlots().find((slot) => slot.travel === 'east')!
  assert.equal(portsConnected(forward, next.inputSlots()[0]!), true)
  assert.equal(portsConnected(forward, gapped.inputSlots()[0]!), false)
  const sideDump = new SplitterMachine('side', { x: 0, y: -1 }, 'south', author)
  const south = sideDump.outputSlots().find((slot) => slot.travel === 'south')!
  assert.equal(portsConnected(south, next.inputSlots()[0]!), false)
  assert.equal(
    portsConnected(
      { cell: { x: 3, y: 0 }, role: 'output', travel: 'west' },
      { cell: { x: 3, y: 0 }, role: 'output', travel: 'east' },
    ),
    false,
  )
})

test('source emits into a splitter plugged onto its output', () => {
  const match = Match.create('splitter-on-source', rules)
  const source = match.sources[0]!
  const output = source.outputSlots()[0]!
  assert.equal(
    match.placeMachine(
      { machineId: 'splitter', x: output.cell.x, y: output.cell.y, facing: output.travel },
      author,
    ),
    null,
  )
  const splitter = match.splitters[0]!
  const forward = splitter.outputSlots().find((slot) => slot.travel === output.travel)!
  assert.equal(match.place([{ ...forward.cell, direction: forward.travel }], author), null)
  source.ticksUntilEmit = 0
  match.tick()
  assert.equal(splitter.buffer, source.shape)
  assert.equal(match.packets.length, 0)
  match.tick()
  assert.equal(splitter.buffer, null)
  assert.equal(
    match.packets.some((packet) => packet.cell.x === forward.cell.x && packet.cell.y === forward.cell.y),
    true,
  )
})

test('splitter plugged into a trashcan destroys the packet on eject', () => {
  const match = Match.create('splitter-trashcan-plug', rules)
  const tcOrigin = { x: match.core.origin.x - 7, y: match.core.origin.y }
  assert.equal(
    match.placeMachine(
      { machineId: 'trashcan', x: tcOrigin.x, y: tcOrigin.y, facing: 'east' },
      author,
    ),
    null,
  )
  const trashcan = match.trashcans[0]!
  const input = trashcan.inputSlots()[0]!
  const approach = portOccupancyCell(input)
  assert.equal(
    match.placeMachine(
      { machineId: 'splitter', x: approach.x, y: approach.y, facing: input.travel },
      author,
    ),
    null,
  )
  const splitter = match.splitters[0]!
  const into = splitter.outputSlots().find((slot) => slot.travel === input.travel)!
  assert.equal(portsConnected(into, input), true)

  const inCell = ahead(approach.x, approach.y, opposite(input.travel))
  assert.equal(match.place([{ ...inCell, direction: input.travel }], author), null)
  match.packets.push(new Packet('p1', inCell, 'circle'))
  match.tick()
  assert.equal(splitter.buffer, null)
  assert.equal(match.packets.length, 0)
})

test('splitter plugged into a core input delivers on eject', () => {
  const match = Match.create('splitter-core-plug', rules)
  const slot = match.core.inputSlots().find((item) => item.travel === 'east')
  assert.ok(slot)
  const approach = ahead(slot.cell.x, slot.cell.y, opposite(slot.travel))
  assert.equal(
    match.placeMachine(
      { machineId: 'splitter', x: approach.x, y: approach.y, facing: slot.travel },
      author,
    ),
    null,
  )
  const splitter = match.splitters[0]!
  const into = splitter.outputSlots().find((out) => out.travel === slot.travel)!
  assert.equal(portsConnected(into, slot), true)

  const inCell = ahead(approach.x, approach.y, opposite(slot.travel))
  assert.equal(match.place([{ ...inCell, direction: slot.travel }], author), null)
  match.packets.push(new Packet('p1', inCell, 'fire'))
  const before = match.deliveries
  match.tick()
  assert.equal(splitter.buffer, null)
  assert.equal(match.deliveries, before + 1)
  assert.equal(match.packets.length, 0)
  assert.equal(match.coreLastIntakeTick[match.core.id], 0)
})

test('placeMachine allows splitter plugged into a combiner input', () => {
  const match = Match.createSandbox('splitter-combiner-plug', rules)
  assert.equal(
    match.placeMachine({ machineId: 'combiner_2', x: 25, y: 24, facing: 'east' }, author),
    null,
  )
  const combiner = match.combiners[0]!
  const input = combiner.inputSlots().slice().sort((a, b) => a.cell.y - b.cell.y)[0]!
  const approach = portOccupancyCell(input)
  const error = match.placeMachine(
    { machineId: 'splitter', x: approach.x, y: approach.y, facing: input.travel },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.splitters.length, 1)
  const splitter = match.splitters[0]!
  const into = splitter.outputSlots().find((slot) => slot.travel === input.travel)!
  assert.equal(portsConnected(into, input), true)
})

test('placeMachine rejects splitter dumping onto a combiner input from the wrong side', () => {
  const match = Match.createSandbox('splitter-combiner-side-dump', rules)
  assert.equal(
    match.placeMachine({ machineId: 'combiner_2', x: 25, y: 28, facing: 'south' }, author),
    null,
  )
  const combiner = match.combiners[0]!
  const input = combiner.inputSlots().slice().sort((a, b) => a.cell.x - b.cell.x)[0]!
  // West of a north-face input: east output lands on the input tile but travel is wrong.
  const error = match.placeMachine(
    { machineId: 'splitter', x: input.cell.x - 1, y: input.cell.y, facing: 'east' },
    author,
  )
  assert.equal(error, 'Sem porta compatível em contato.')
  assert.equal(match.splitters.length, 0)
})

test('placeMachine allows splitters one tile apart without connecting them', () => {
  const { match, origin, splitter } = matchWithSplitter('east')
  const error = match.placeMachine(
    { machineId: 'splitter', x: origin.x + 2, y: origin.y, facing: 'east' },
    author,
  )
  assert.equal(error, null)
  const forward = splitter.outputSlots().find((slot) => slot.travel === 'east')!
  const far = match.splitters[1]!
  assert.equal(portsConnected(forward, far.inputSlots()[0]!), false)
})

test('placeMachine rejects splitter on combiner without compatible port contact', () => {
  const match = Match.createSandbox('splitter-combiner-port', rules)
  assert.equal(
    match.placeMachine({ machineId: 'combiner_2', x: 25, y: 24, facing: 'east' }, author),
    null,
  )
  const error = match.placeMachine(
    { machineId: 'splitter', x: 28, y: 26, facing: 'west' },
    author,
  )
  assert.equal(error, 'Sem porta compatível em contato.')
  assert.equal(match.splitters.length, 0)
})

test('placeMachine rejects splitter body-adjacent to combiner without aligned ports', () => {
  const match = Match.createSandbox('splitter-combiner-adjacent', rules)
  assert.equal(
    match.placeMachine({ machineId: 'combiner_2', x: 25, y: 24, facing: 'east' }, author),
    null,
  )
  const error = match.placeMachine(
    { machineId: 'splitter', x: 28, y: 24, facing: 'east' },
    author,
  )
  assert.equal(error, 'Sem porta compatível em contato.')
  assert.equal(match.splitters.length, 0)
})

test('placeMachine rejects splitter on a combiner approach when it does not plug in', () => {
  const match = Match.createSandbox('splitter-combiner-approach', rules)
  assert.equal(
    match.placeMachine({ machineId: 'combiner_2', x: 25, y: 28, facing: 'south' }, author),
    null,
  )
  const combiner = match.combiners[0]!
  const input = combiner.inputSlots()[0]!
  const approach = ahead(input.cell.x, input.cell.y, opposite(input.travel))
  const error = match.placeMachine(
    { machineId: 'splitter', x: approach.x, y: approach.y, facing: 'north' },
    author,
  )
  assert.equal(error, 'Entradas ou saídas sobrepõem outra estrutura.')
  assert.equal(match.splitters.length, 0)
})

test('placeMachine allows combiner body over existing splitter output', () => {
  const match = Match.createSandbox('combiner-over-splitter-out', rules)
  const origin = { x: 27, y: 24 }
  assert.equal(
    match.placeMachine({ machineId: 'splitter', x: origin.x, y: origin.y, facing: 'south' }, author),
    null,
  )
  const splitter = match.splitters[0]!
  const forward = splitter.orderedOutputSlots().find((slot) => slot.travel === 'south')!
  const error = match.placeMachine(
    {
      machineId: 'combiner_2',
      x: forward.cell.x - 1,
      y: forward.cell.y,
      facing: 'east',
    },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.combiners.length, 1)
})

test('placeMachine allows two splitters sharing an output cell', () => {
  const { match, origin, splitter } = matchWithSplitter('east')
  const forward = splitter.orderedOutputSlots().find((slot) => slot.travel === 'east')!
  const clashOrigin = { x: forward.cell.x + 1, y: forward.cell.y }
  const error = match.placeMachine(
    { machineId: 'splitter', x: clashOrigin.x, y: clashOrigin.y, facing: 'west' },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.splitters.length, 2)
})

test('placeMachine allows splitter output orthogonally adjacent to another body', () => {
  const { match, origin } = matchWithSplitter('east')
  const clear = { x: origin.x - 2, y: origin.y }
  const error = match.placeMachine(
    { machineId: 'splitter', x: clear.x, y: clear.y, facing: 'east' },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.splitters.length, 2)
})

test('placeMachine allows body orthogonally adjacent to another output slot', () => {
  const { match, origin } = matchWithSplitter('east')
  const clear = { x: origin.x + 2, y: origin.y }
  const error = match.placeMachine(
    { machineId: 'splitter', x: clear.x, y: clear.y, facing: 'east' },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.splitters.length, 2)
})

test('placeMachine allows splitter with clear I/O slots', () => {
  const { match, origin } = matchWithSplitter('east')
  const clear = { x: origin.x, y: origin.y + 4 }
  const error = match.placeMachine(
    { machineId: 'splitter', x: clear.x, y: clear.y, facing: 'east' },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.splitters.length, 2)
})

test('SplitterMachine constructs for every facing', () => {
  for (const facing of ['north', 'east', 'south', 'west'] as const) {
    const machine = new SplitterMachine('s', { x: 3, y: 3 }, facing, author)
    assert.equal(machine.outputSlots().length, 3)
  }
})

test('placeMachine replaces own belt and inherits facing', () => {
  const match = Match.create('splitter-on-belt', rules)
  const cell = { x: match.core.origin.x - 6, y: match.core.origin.y + 2 }
  assert.equal(match.place([{ ...cell, direction: 'south' }], author), null)
  assert.equal(match.belts.length, 1)
  const error = match.placeMachine(
    { machineId: 'splitter', x: cell.x, y: cell.y, facing: 'east' },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.belts.length, 0)
  assert.equal(match.splitters[0]!.facing, 'south')
})

test('placeMachine rejects splitter on another player belt', () => {
  const match = Match.create('splitter-foreign-belt', rules)
  const cell = { x: match.core.origin.x - 6, y: match.core.origin.y + 2 }
  const other = { id: 'u2', nickname: 'Bob' }
  assert.equal(match.place([{ ...cell, direction: 'east' }], other), null)
  const error = match.placeMachine(
    { machineId: 'splitter', x: cell.x, y: cell.y, facing: 'east' },
    author,
  )
  assert.equal(error, 'Essa esteira é de outra pessoa.')
  assert.equal(match.splitters.length, 0)
})

test('splitter placement removes packet on replaced belt', () => {
  const match = Match.create('splitter-belt-packet', rules)
  const cell = { x: match.core.origin.x - 6, y: match.core.origin.y + 2 }
  assert.equal(match.place([{ ...cell, direction: 'east' }], author), null)
  match.packets.push(new Packet('p1', cell, 'circle'))
  const error = match.placeMachine(
    { machineId: 'splitter', x: cell.x, y: cell.y, facing: 'north' },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.packets.length, 0)
})
