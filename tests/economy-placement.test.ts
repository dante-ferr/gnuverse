import assert from 'node:assert/strict'
import test from 'node:test'
import { speedDowngradeRefund, structureRefund } from '../game-server/economy/prices.ts'
import { Match } from '../game-server/pipeline/world/match.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

const author = { id: 'a', nickname: 'Ada' }
const other = { id: 'b', nickname: 'Bea' }

test('belt redraws of the same speed are free and a speed change is billed', () => {
  const rules = testPipelineRules()
  const match = Match.create('belt-bill', rules)
  const cell = { x: match.core.origin.x + 6, y: match.core.origin.y, direction: 'east' as const }
  assert.equal(match.isOwnedCell(cell), true)
  const placed = match.placeBilling([cell], author, 1)
  assert.equal(placed.error, null)
  assert.equal(placed.billableCells, 1)
  assert.equal(placed.refundCells, 0)
  const redraw = match.placeBilling([{ ...cell, direction: 'north' }], author, 1)
  assert.equal(redraw.error, null)
  assert.equal(redraw.billableCells, 0)
  assert.equal(redraw.refundCells, 0)
  const upgraded = match.placeBilling([cell], author, rules.beltSpeedFast)
  assert.equal(upgraded.billableCells, 1)
  assert.equal(upgraded.refundCells, 0)
  const downgraded = match.placeBilling([cell], author, 1)
  assert.equal(downgraded.billableCells, 0)
  assert.equal(downgraded.refundCells, 1)
  assert.equal(
    speedDowngradeRefund(rules, 'belt'),
    structureRefund(rules, rules.fastBeltCost - rules.beltCost),
  )
  const denied = match.remove(cell, other)
  assert.match(denied.error ?? '', /outra pessoa/)
  const removed = match.remove(cell, author)
  assert.equal(removed.error, null)
  assert.equal(removed.listPrice, rules.beltCost)
  assert.equal(structureRefund(rules, removed.listPrice), 0)
})

test('tunnel same-speed redraws are free and speed changes bill or refund', () => {
  const rules = testPipelineRules()
  const match = Match.create('tunnel-bill', rules)
  const entrance = { x: match.core.origin.x - 8, y: match.core.origin.y + 2 }
  const exit = { x: entrance.x + 3, y: entrance.y }
  const placed = match.placeMachineBilling(
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
  assert.equal(placed.error, null)
  assert.equal(placed.billable, true)
  assert.equal(placed.refund, false)
  const redraw = match.placeMachineBilling(
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
  assert.equal(redraw.error, null)
  assert.equal(redraw.billable, false)
  assert.equal(redraw.refund, false)
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
  assert.equal(upgraded.refund, false)
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
  assert.equal(downgraded.billable, false)
  assert.equal(downgraded.refund, true)
  assert.equal(
    speedDowngradeRefund(rules, 'tunnel'),
    structureRefund(rules, rules.fastTunnelCost - rules.tunnelCost),
  )
})

test('structureRefund uses refund_percent from rules', () => {
  const half = testPipelineRules({ refundPercent: 50 })
  assert.equal(structureRefund(half, 1), 0)
  assert.equal(structureRefund(half, 15), 7)
  const full = testPipelineRules({ refundPercent: 100 })
  assert.equal(structureRefund(full, 15), 15)
  const none = testPipelineRules({ refundPercent: 0 })
  assert.equal(structureRefund(none, 15), 0)
})

test('speedDowngradeRefund applies refund_percent to the fast−normal difference', () => {
  const rules = testPipelineRules()
  assert.equal(speedDowngradeRefund(rules, 'belt'), 1)
  assert.equal(speedDowngradeRefund(rules, 'tunnel'), 6)
})
