import assert from 'node:assert/strict'
import test from 'node:test'
import { Packet } from '../game-server/pipeline/packets/packet.ts'
import { tunnelPairGeometry } from '../game-server/pipeline/machines/tunnel-machine.ts'
import { ahead, opposite } from '../game-server/pipeline/geometry/direction.ts'
import {
  portOccupancyCell,
  portsConnected,
} from '../game-server/pipeline/world/edit/building-slots.ts'
import { Match } from '../game-server/pipeline/world/match.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

const rules = testPipelineRules({ tunnelMaxGap: 8 })
const author = { id: 'u1', nickname: 'Ada' }

function placeTunnelPair(match: Match, entrance: { x: number; y: number }, gap: number) {
  const exit = { x: entrance.x + gap + 1, y: entrance.y }
  const error = match.placeMachine(
    {
      machineId: 'tunnel',
      entranceX: entrance.x,
      entranceY: entrance.y,
      exitX: exit.x,
      exitY: exit.y,
      facing: 'east',
    },
    author,
  )
  return { error, exit }
}

test('tunnelPairGeometry accepts Factorio-style same-axis gap', () => {
  const ok = tunnelPairGeometry({ x: 2, y: 5 }, { x: 6, y: 5 }, 'east', 8)
  assert.equal(ok.ok, true)
  if (ok.ok) assert.equal(ok.gap, 3)
  const adjacent = tunnelPairGeometry({ x: 2, y: 5 }, { x: 3, y: 5 }, 'east', 8)
  assert.equal(adjacent.ok, true)
  if (adjacent.ok) assert.equal(adjacent.gap, 0)
  const bad = tunnelPairGeometry({ x: 2, y: 5 }, { x: 20, y: 5 }, 'east', 8)
  assert.equal(bad.ok, false)
})

test('tunnel exit plugged into a core input delivers', () => {
  const match = Match.create('tunnel-core-plug', rules)
  const slot = match.core.inputSlots().find((item) => item.travel === 'east')
  assert.ok(slot)
  const exitCell = ahead(slot.cell.x, slot.cell.y, opposite(slot.travel))
  const entrance = { x: exitCell.x - 1, y: exitCell.y }
  assert.equal(
    match.placeMachine(
      {
        machineId: 'tunnel',
        entranceX: entrance.x,
        entranceY: entrance.y,
        exitX: exitCell.x,
        exitY: exitCell.y,
        facing: slot.travel,
      },
      author,
    ),
    null,
  )
  const exitPortal = match.tunnels.find((p) => p.role === 'exit')!
  const into = exitPortal.outputSlots()[0]!
  assert.equal(portsConnected(into, slot), true)

  const inCell = { x: entrance.x - 1, y: entrance.y }
  assert.equal(match.place([{ ...inCell, direction: slot.travel }], author), null)
  match.packets.push(new Packet('p1', inCell, 'fire'))
  const before = match.deliveries
  match.tick()
  assert.equal(match.deliveries, before + 1)
  assert.equal(match.packets.length, 0)
  assert.equal(match.coreLastIntakeTick[match.core.id], 0)
})

test('placeMachine allows tunnel exit plugged into a combiner input', () => {
  const match = Match.createSandbox('tunnel-combiner-plug', rules)
  assert.equal(
    match.placeMachine({ machineId: 'combiner_2', x: 26, y: 24, facing: 'east' }, author),
    null,
  )
  const combiner = match.combiners[0]!
  const input = combiner.inputSlots().slice().sort((a, b) => a.cell.y - b.cell.y)[0]!
  const exitCell = ahead(input.cell.x, input.cell.y, opposite(input.travel))
  const entrance = { x: exitCell.x - 1, y: exitCell.y }
  const error = match.placeMachine(
    {
      machineId: 'tunnel',
      entranceX: entrance.x,
      entranceY: entrance.y,
      exitX: exitCell.x,
      exitY: exitCell.y,
      facing: input.travel,
    },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.tunnels.length, 2)
  const exitPortal = match.tunnels.find((p) => p.role === 'exit')!
  const into = exitPortal.outputSlots()[0]!
  assert.equal(portsConnected(into, input), true)
})

test('tunnel exit plugged into a trashcan destroys the packet', () => {
  const match = Match.createSandbox('tunnel-trashcan-plug', rules)
  const tcOrigin = { x: 27, y: 24 }
  assert.equal(
    match.placeMachine(
      { machineId: 'trashcan', x: tcOrigin.x, y: tcOrigin.y, facing: 'east' },
      author,
    ),
    null,
  )
  const trashcan = match.trashcans[0]!
  const input = trashcan.inputSlots()[0]!
  const exitCell = portOccupancyCell(input)
  const entrance = { x: exitCell.x - 1, y: exitCell.y }
  assert.equal(
    match.placeMachine(
      {
        machineId: 'tunnel',
        entranceX: entrance.x,
        entranceY: entrance.y,
        exitX: exitCell.x,
        exitY: exitCell.y,
        facing: input.travel,
      },
      author,
    ),
    null,
  )
  const inCell = { x: entrance.x - 1, y: entrance.y }
  assert.equal(match.place([{ ...inCell, direction: input.travel }], author), null)
  match.packets.push(new Packet('p1', inCell, 'circle'))
  match.tick()
  assert.equal(match.packets.length, 0)
  const entrancePortal = match.tunnels.find((p) => p.role === 'entrance')!
  assert.ok(entrancePortal.queue.every((slot) => slot == null))
})

test('gap 0 tunnel has no queue and delivers on absorb', () => {
  const match = Match.create('tunnel-gap0', rules)
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const { error, exit } = placeTunnelPair(match, entrance, 0)
  assert.equal(error, null)
  const entrancePortal = match.tunnels.find((p) => p.role === 'entrance')!
  assert.equal(entrancePortal.queue.length, 0)
  const inCell = { x: entrance.x - 1, y: entrance.y }
  const outCell = { x: exit.x + 1, y: exit.y }
  assert.equal(match.place([{ ...inCell, direction: 'east' }], author), null)
  assert.equal(match.place([{ ...outCell, direction: 'east' }], author), null)
  const packetId = `p${match.nextPacketId++}`
  match.packets.push(new Packet(packetId, inCell, 'circle'))
  match.tick()
  assert.equal(match.packets.length, 1)
  assert.ok(match.packets.some((packet) => packet.cell.x === outCell.x && packet.cell.y === outCell.y))
})

test('placeMachine accepts tunnel pair in normal rooms', () => {
  const match = Match.create('tunnel-test', rules)
  // Stay inside the owned starter chunk (west of the core, clear of pads).
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const { error } = placeTunnelPair(match, entrance, 3)
  assert.equal(error, null)
  assert.equal(match.tunnels.length, 2)
  const entrancePortal = match.tunnels.find((p) => p.role === 'entrance')!
  assert.equal(entrancePortal.queue.length, 3)
})

test('tunnel rejects gap beyond tunnel_max_gap', () => {
  const match = Match.create('tunnel-far', rules)
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const { error } = placeTunnelPair(match, entrance, rules.tunnelMaxGap + 1)
  assert.ok(error)
  assert.equal(match.tunnels.length, 0)
})

test('tunnel carries packet underground under a surface belt', () => {
  const match = Match.create('tunnel-flow', rules)
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const gap = 2
  const { error, exit } = placeTunnelPair(match, entrance, gap)
  assert.equal(error, null)
  const inCell = { x: entrance.x - 1, y: entrance.y }
  const outCell = { x: exit.x + 1, y: exit.y }
  const overGap = { x: entrance.x + 1, y: entrance.y }
  assert.equal(match.place([{ ...inCell, direction: 'east' }], author), null)
  assert.equal(match.place([{ ...outCell, direction: 'east' }], author), null)
  // Surface belt crossing the underground gap must not block the tunnel.
  assert.equal(match.place([{ ...overGap, direction: 'south' }], author), null)
  match.packets.push(new Packet('p1', inCell, 'circle'))
  match.tick() // absorb — dwells on entrance before gap lane
  const portal = match.tunnels.find((p) => p.role === 'entrance')!
  assert.ok(portal.pendingIngress === 'circle' || portal.queue.some((slot) => slot === 'circle'))
  assert.equal(match.packets.length, 0)
  for (let i = 0; i < gap + 2; i++) match.tick()
  assert.ok(match.packets.some((packet) => packet.cell.x === outCell.x && packet.cell.y === outCell.y))
})

test('tunnel dwells on entrance and exit tiles like conveyors', () => {
  const match = Match.create('tunnel-dwell', rules)
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const gap = 2
  const { error, exit } = placeTunnelPair(match, entrance, gap)
  assert.equal(error, null)
  const inCell = { x: entrance.x - 1, y: entrance.y }
  const outCell = { x: exit.x + 1, y: exit.y }
  assert.equal(match.place([{ ...inCell, direction: 'east' }], author), null)
  assert.equal(match.place([{ ...outCell, direction: 'east' }], author), null)
  match.packets.push(new Packet('p1', inCell, 'circle'))
  match.tick()
  const portal = match.tunnels.find((p) => p.role === 'entrance')!
  assert.equal(portal.pendingIngress, 'circle')
  assert.deepEqual(portal.queue, [null, null])
  assert.equal(portal.pendingEgress, null)
  match.tick()
  assert.equal(portal.pendingIngress, null)
  assert.deepEqual(portal.queue, ['circle', null])
  assert.equal(portal.pendingEgress, null)
  match.tick()
  assert.deepEqual(portal.queue, [null, 'circle'])
  assert.equal(portal.pendingEgress, null)
  match.tick()
  assert.deepEqual(portal.queue, [null, null])
  assert.equal(portal.pendingEgress, 'circle')
  assert.equal(match.packets.length, 0)
  match.tick()
  assert.equal(portal.pendingEgress, null)
  assert.ok(match.packets.some((packet) => packet.cell.x === outCell.x && packet.cell.y === outCell.y))
})

test('placeMachine replaces own belts on tunnel span and inherits facing', () => {
  const match = Match.create('tunnel-on-belts', rules)
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const gap = 2
  const exit = { x: entrance.x + gap + 1, y: entrance.y }
  for (let x = entrance.x; x <= exit.x; x++) {
    assert.equal(match.place([{ x, y: entrance.y, direction: 'east' }], author), null)
  }
  assert.equal(match.belts.length, gap + 2)
  const error = match.placeMachine(
    {
      machineId: 'tunnel',
      entranceX: entrance.x,
      entranceY: entrance.y,
      exitX: exit.x,
      exitY: exit.y,
      facing: 'north',
    },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.belts.length, gap)
  assert.ok(match.belts.every((belt) => belt.origin.x > entrance.x && belt.origin.x < exit.x))
  const entrancePortal = match.tunnels.find((p) => p.role === 'entrance')!
  assert.equal(entrancePortal.direction, 'east')
})

test('placeMachine keeps a foreign belt in the tunnel gap', () => {
  const match = Match.create('tunnel-foreign-gap', rules)
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const gap = 2
  const exit = { x: entrance.x + gap + 1, y: entrance.y }
  const mid = { x: entrance.x + 1, y: entrance.y }
  const other = { id: 'u2', nickname: 'Bob' }
  assert.equal(match.place([{ ...entrance, direction: 'east' }], author), null)
  assert.equal(match.place([{ ...mid, direction: 'east' }], other), null)
  assert.equal(match.place([{ ...exit, direction: 'east' }], author), null)
  const error = match.placeMachine(
    {
      machineId: 'tunnel',
      entranceX: entrance.x,
      entranceY: entrance.y,
      exitX: exit.x,
      exitY: exit.y,
      facing: 'east',
    },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.belts.length, 1)
  assert.equal(match.belts[0]!.authorId, other.id)
})

test('placeMachine replaces another player belt on a portal cell', () => {
  const match = Match.create('tunnel-foreign-portal', rules)
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const exit = { x: entrance.x + 3, y: entrance.y }
  const other = { id: 'u2', nickname: 'Bob' }
  assert.equal(match.place([{ ...exit, direction: 'east' }], other), null)
  const error = match.placeMachine(
    {
      machineId: 'tunnel',
      entranceX: entrance.x,
      entranceY: entrance.y,
      exitX: exit.x,
      exitY: exit.y,
      facing: 'east',
    },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.tunnels.length, 2)
})

test('tunnel placement clears packets on removed span belts', () => {
  const match = Match.create('tunnel-belt-packets', rules)
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const gap = 1
  const exit = { x: entrance.x + gap + 1, y: entrance.y }
  const mid = { x: entrance.x + 1, y: entrance.y }
  assert.equal(match.place([{ ...entrance, direction: 'east' }], author), null)
  assert.equal(match.place([{ ...mid, direction: 'east' }], author), null)
  assert.equal(match.place([{ ...exit, direction: 'east' }], author), null)
  match.packets.push(new Packet('p1', entrance, 'circle'))
  match.packets.push(new Packet('p2', mid, 'square'))
  const error = match.placeMachine(
    {
      machineId: 'tunnel',
      entranceX: entrance.x,
      entranceY: entrance.y,
      exitX: exit.x,
      exitY: exit.y,
      facing: 'east',
    },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.packets.length, 1)
  assert.equal(match.packets[0]!.shape, 'square')
  assert.equal(match.packets[0]!.cell.x, mid.x)
})

test('placeMachine allows tunnel portal beside a splitter without a port link', () => {
  const match = Match.create('tunnel-splitter-touch', rules)
  const splitterCell = { x: match.core.origin.x - 4, y: match.core.origin.y + 2 }
  assert.equal(
    match.placeMachine(
      { machineId: 'splitter', x: splitterCell.x, y: splitterCell.y, facing: 'east' },
      author,
    ),
    null,
  )
  const entrance = { x: splitterCell.x - 1, y: splitterCell.y }
  const exit = { x: entrance.x - 4, y: entrance.y }
  const error = match.placeMachine(
    {
      machineId: 'tunnel',
      entranceX: entrance.x,
      entranceY: entrance.y,
      exitX: exit.x,
      exitY: exit.y,
      facing: 'west',
    },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.tunnels.length, 2)
})

test('tunnel links a splitter output to a combiner input across one belt', () => {
  const match = Match.createSandbox('tunnel-splitter-combiner', rules)
  assert.equal(
    match.placeMachine({ machineId: 'combiner_2', x: 25, y: 24, facing: 'north' }, author),
    null,
  )
  assert.equal(
    match.placeMachine({ machineId: 'splitter', x: 25, y: 30, facing: 'north' }, author),
    null,
  )
  assert.equal(match.place([{ x: 25, y: 28, direction: 'east' }], author), null)
  const error = match.placeMachine(
    {
      machineId: 'tunnel',
      entranceX: 25,
      entranceY: 29,
      exitX: 25,
      exitY: 27,
      facing: 'north',
    },
    author,
  )
  assert.equal(error, null)
  assert.equal(match.belts.length, 1)
  assert.equal(match.belts[0]!.origin.y, 28)
  const splitter = match.splitters[0]!
  splitter.buffer = 'fire'
  for (let i = 0; i < 4; i++) match.tick()
  assert.equal(match.combiners[0]!.buffer.fire, 1)
})

test('remove either portal removes the pair', () => {
  const match = Match.create('tunnel-remove', rules)
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const { error, exit } = placeTunnelPair(match, entrance, 2)
  assert.equal(error, null)
  const result = match.remove(exit, author)
  assert.equal(result.error, null)
  assert.equal(result.kind, 'tunnel')
  assert.equal(match.tunnels.length, 0)
})

test('placeMachine upgrades an owned tunnel pair to fast and redraws are free', () => {
  const match = Match.create('tunnel-upgrade', rules)
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const { error, exit } = placeTunnelPair(match, entrance, 2)
  assert.equal(error, null)
  const portal = match.tunnels.find((item) => item.role === 'entrance')!
  portal.queue[0] = 'circle'
  const upgraded = match.placeMachineBilling(
    {
      machineId: 'fast_tunnel',
      entranceX: entrance.x,
      entranceY: entrance.y,
      exitX: exit.x,
      exitY: exit.y,
      facing: 'east',
    },
    author,
  )
  assert.equal(upgraded.error, null)
  assert.equal(upgraded.billable, true)
  assert.equal(match.tunnels.length, 2)
  assert.ok(match.tunnels.every((item) => item.speed === rules.beltSpeedFast))
  assert.equal(match.tunnels.find((item) => item.role === 'entrance')!.queue[0], 'circle')
  const redraw = match.placeMachineBilling(
    {
      machineId: 'fast_tunnel',
      entranceX: entrance.x,
      entranceY: entrance.y,
      exitX: exit.x,
      exitY: exit.y,
      facing: 'east',
    },
    author,
  )
  assert.equal(redraw.error, null)
  assert.equal(redraw.billable, false)
})

test('placeMachine lets another player upgrade a tunnel, with no refund on downgrade', () => {
  const match = Match.create('tunnel-upgrade-foreign', rules)
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const { error, exit } = placeTunnelPair(match, entrance, 2)
  assert.equal(error, null)
  const other = { id: 'u2', nickname: 'Bob' }
  const upgraded = match.placeMachineBilling(
    {
      machineId: 'fast_tunnel',
      entranceX: entrance.x,
      entranceY: entrance.y,
      exitX: exit.x,
      exitY: exit.y,
      facing: 'east',
    },
    other,
  )
  assert.equal(upgraded.error, null)
  assert.equal(upgraded.billable, true)
  assert.ok(match.tunnels.every((item) => item.speed === rules.beltSpeedFast))
  const downgraded = match.placeMachineBilling(
    {
      machineId: 'tunnel',
      entranceX: entrance.x,
      entranceY: entrance.y,
      exitX: exit.x,
      exitY: exit.y,
      facing: 'east',
    },
    author,
  )
  assert.equal(downgraded.error, null)
  assert.equal(downgraded.refund, false)
})

test('a one-cell gap between a splitter output and a tunnel does not transfer', () => {
  const match = Match.createSandbox('tunnel-one-gap', rules)
  assert.equal(
    match.placeMachine({ machineId: 'splitter', x: 25, y: 30, facing: 'east' }, author),
    null,
  )
  const error = match.placeMachine(
    {
      machineId: 'tunnel',
      entranceX: 27,
      entranceY: 30,
      exitX: 30,
      exitY: 30,
      facing: 'east',
    },
    author,
  )
  assert.equal(error, null)
  const splitter = match.splitters[0]!
  splitter.buffer = 'fire'
  match.tick()
  assert.equal(splitter.buffer, 'fire')
  const entrance = match.tunnels.find((portal) => portal.role === 'entrance')!
  assert.ok(entrance.queue.every((slot) => slot == null))
  assert.equal(match.packets.length, 0)
})

test('a belt on that one-cell gap carries the packet into the tunnel', () => {
  const match = Match.createSandbox('tunnel-one-gap-belt', rules)
  assert.equal(
    match.placeMachine({ machineId: 'splitter', x: 25, y: 30, facing: 'east' }, author),
    null,
  )
  assert.equal(
    match.placeMachine(
      {
        machineId: 'tunnel',
        entranceX: 27,
        entranceY: 30,
        exitX: 30,
        exitY: 30,
        facing: 'east',
      },
      author,
    ),
    null,
  )
  assert.equal(match.place([{ x: 26, y: 30, direction: 'east' }], author), null)
  match.splitters[0]!.buffer = 'fire'
  match.tick()
  match.tick()
  const entrance = match.tunnels.find((portal) => portal.role === 'entrance')!
  assert.ok(entrance.pendingIngress === 'fire' || entrance.queue.some((slot) => slot === 'fire'))
})

test('a tunnel sitting on a splitter output still receives the packet', () => {
  const match = Match.createSandbox('tunnel-zero-gap', rules)
  assert.equal(
    match.placeMachine({ machineId: 'splitter', x: 25, y: 30, facing: 'east' }, author),
    null,
  )
  assert.equal(
    match.placeMachine(
      {
        machineId: 'tunnel',
        entranceX: 26,
        entranceY: 30,
        exitX: 29,
        exitY: 30,
        facing: 'east',
      },
      author,
    ),
    null,
  )
  match.splitters[0]!.buffer = 'fire'
  match.tick()
  assert.equal(match.splitters[0]!.buffer, null)
  const entrance = match.tunnels.find((portal) => portal.role === 'entrance')!
  assert.equal(entrance.pendingIngress, 'fire')
  assert.ok(!entrance.queue.some((slot) => slot === 'fire'))
})

test('gap 0 pass-through is reported as transit for the client', () => {
  const match = Match.create('tunnel-gap0-transit', rules)
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const { error, exit } = placeTunnelPair(match, entrance, 0)
  assert.equal(error, null)
  const inCell = { x: entrance.x - 1, y: entrance.y }
  const outCell = { x: exit.x + 1, y: exit.y }
  assert.equal(match.place([{ ...inCell, direction: 'east' }], author), null)
  assert.equal(match.place([{ ...outCell, direction: 'east' }], author), null)
  match.packets.push(new Packet('p-transit', inCell, 'circle'))
  match.tick()
  const frame = match.toFrame()
  const portal = frame.tunnels?.find((item) => item.role === 'entrance')
  assert.deepEqual(portal?.transit, ['circle'])
  assert.ok(!portal?.queue?.some((slot) => slot != null))
})
