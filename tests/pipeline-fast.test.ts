import assert from 'node:assert/strict'
import test from 'node:test'
import { Packet } from '../game-server/pipeline/packets/packet.ts'
import { Match } from '../game-server/pipeline/world/match.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

const rules = testPipelineRules()
const author = { id: 'u1', nickname: 'Ada' }

test('fast belt moves three cells in one tick on a clear line', () => {
  const match = Match.createSandbox('fast-belt-line', rules)
  const y = 24
  const x0 = 28
  const cells = []
  for (let x = x0; x < x0 + 6; x++) {
    cells.push({ x, y, direction: 'east' as const })
  }
  assert.equal(match.place(cells, author, rules.beltSpeedFast), null)
  match.packets.push(new Packet('p1', { x: x0, y }, 'circle'))
  match.tick()
  const packet = match.packets.find((item) => item.id === 'p1')
  assert.ok(packet)
  assert.equal(packet!.cell.x, x0 + rules.beltSpeedFast)
  assert.equal(packet!.cell.y, y)
})

test('normal belt still moves one cell per tick', () => {
  const match = Match.createSandbox('slow-belt-line', rules)
  const y = 24
  const x0 = 28
  const cells = []
  for (let x = x0; x < x0 + 6; x++) {
    cells.push({ x, y, direction: 'east' as const })
  }
  assert.equal(match.place(cells, author), null)
  match.packets.push(new Packet('p1', { x: x0, y }, 'circle'))
  match.tick()
  const packet = match.packets.find((item) => item.id === 'p1')
  assert.ok(packet)
  assert.equal(packet!.cell.x, x0 + 1)
})

test('fast tunnel advances underground queue three steps per tick', () => {
  const match = Match.create('fast-tunnel-queue', rules)
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const exit = { x: entrance.x + 4, y: entrance.y }
  assert.equal(
    match.placeMachine(
      {
        machineId: 'fast_tunnel',
        entranceX: entrance.x,
        entranceY: entrance.y,
        exitX: exit.x,
        exitY: exit.y,
        facing: 'east',
      },
      author,
    ),
    null,
  )
  const portal = match.tunnels.find((item) => item.role === 'entrance')!
  assert.equal(portal.speed, rules.beltSpeedFast)
  portal.queue = ['circle', 'circle', 'circle', null]
  match.tick()
  assert.equal(portal.queue[0], null)
  assert.ok(portal.queue[3] === 'circle' || portal.pendingEgress === 'circle')
})