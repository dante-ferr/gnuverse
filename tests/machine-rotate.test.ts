import assert from 'node:assert/strict'
import test from 'node:test'
import { Match } from '../game-server/pipeline/world/match.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

const rules = testPipelineRules()
const owner = { id: 'u1', nickname: 'Ada' }
const other = { id: 'u2', nickname: 'Bo' }

test('rotating a machine keeps its author and changes facing', () => {
  const match = Match.createSandbox('rotate', rules)
  assert.equal(match.placeMachine({ machineId: 'splitter', x: 25, y: 24, facing: 'east' }, owner), null)
  const spec = { machineId: 'splitter', x: 25, y: 24, facing: 'south' } as const
  assert.equal(match.rotateMachine(spec, { x: 25, y: 24 }, 'south', other), null)
  const splitter = match.splitters[0]!
  assert.equal(splitter.facing, 'south')
  assert.equal(splitter.authorId, owner.id)
  assert.equal(match.rotateMachine(spec, { x: 25, y: 24 }, 'south', other), 'Já está nessa direção.')
})

test('rotating a tunnel reverses entrance and exit', () => {
  const match = Match.createSandbox('rotate-tunnel', rules)
  const placed = match.placeMachine(
    { machineId: 'tunnel', entranceX: 25, entranceY: 24, exitX: 28, exitY: 24, facing: 'east' },
    owner,
  )
  assert.equal(placed, null)
  const spec = { machineId: 'tunnel', entranceX: 25, entranceY: 24, exitX: 28, exitY: 24, facing: 'west' } as const
  assert.equal(match.rotateMachine(spec, { x: 25, y: 24 }, 'west', other), null)
  const entrance = match.tunnels.find((p) => p.role === 'entrance')!
  assert.deepEqual(entrance.origin, { x: 28, y: 24 })
  assert.equal(entrance.direction, 'west')
  assert.equal(entrance.authorId, owner.id)
})

test('rotating combiner_3 keeps its center', () => {
  const match = Match.createSandbox('rotate-comb', rules)
  assert.equal(match.placeMachine({ machineId: 'combiner_3', x: 24, y: 26, facing: 'east' }, owner), null)
  const spec = { machineId: 'combiner_3', x: 26, y: 27, facing: 'north' } as const
  assert.equal(match.rotateMachine(spec, { x: 26, y: 27 }, 'north', owner), null)
  const c = match.combiners[0]!
  assert.deepEqual([c.origin.x, c.origin.y, c.width, c.height], [25, 25, 3, 5])
})

test('same-speed belt redraw keeps the original author', () => {
  const match = Match.createSandbox('author-belt', rules)
  match.place([{ x: 25, y: 24, direction: 'east' }], owner)
  match.place([{ x: 25, y: 24, direction: 'south' }], other)
  const belt = match.beltAt({ x: 25, y: 24 })!
  assert.equal(belt.direction, 'south')
  assert.equal(belt.authorId, owner.id)
})

test('placing a splitter over an own belt reports its refund', () => {
  const match = Match.createSandbox('overwrite', rules)
  match.place([{ x: 25, y: 24, direction: 'east' }], owner)
  const own = match.placeMachineBilling({ machineId: 'splitter', x: 25, y: 24, facing: 'east' }, owner)
  assert.equal(own.error, null)
  assert.equal(own.overwrittenRefund, Math.floor((rules.beltCost * rules.refundPercent) / 100))
  match.place([{ x: 25, y: 26, direction: 'east' }], other)
  const foreign = match.placeMachineBilling({ machineId: 'splitter', x: 25, y: 26, facing: 'east' }, owner)
  assert.equal(foreign.overwrittenRefund, 0)
})
