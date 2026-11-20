import assert from 'node:assert/strict'
import test from 'node:test'
import { Packet } from '../game-server/pipeline/packets/packet.ts'
import { tunnelPairGeometry } from '../game-server/pipeline/machines/tunnel-machine.ts'
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
  const bad = tunnelPairGeometry({ x: 2, y: 5 }, { x: 20, y: 5 }, 'east', 8)
  assert.equal(bad.ok, false)
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
  match.tick() // absorb into underground lane 0
  const portal = match.tunnels.find((p) => p.role === 'entrance')!
  assert.ok(portal.queue.some((slot) => slot === 'circle'))
  assert.equal(match.packets.length, 0)
  for (let i = 0; i < gap + 2; i++) match.tick()
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
  assert.equal(match.belts.length, 0)
  const entrancePortal = match.tunnels.find((p) => p.role === 'entrance')!
  assert.equal(entrancePortal.direction, 'east')
})

test('placeMachine rejects tunnel when a belt in the span belongs to another player', () => {
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
  assert.equal(error, 'Essa esteira é de outra pessoa.')
  assert.equal(match.tunnels.length, 0)
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
  assert.equal(match.packets.length, 0)
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
