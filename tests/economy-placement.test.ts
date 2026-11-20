import assert from 'node:assert/strict'
import test from 'node:test'
import { halfRefund } from '../game-server/economy/prices.ts'
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
  const redraw = match.placeBilling([{ ...cell, direction: 'north' }], author, 1)
  assert.equal(redraw.error, null)
  assert.equal(redraw.billableCells, 0)
  const upgraded = match.placeBilling([cell], author, rules.beltSpeedFast)
  assert.equal(upgraded.billableCells, 1)
  const denied = match.remove(cell, other)
  assert.match(denied.error ?? '', /outra pessoa/)
  const removed = match.remove(cell, author)
  assert.equal(removed.error, null)
  assert.equal(removed.listPrice, rules.fastBeltCost)
  assert.equal(halfRefund(removed.listPrice), 2)
})

test('half refund rounds down', () => {
  assert.equal(halfRefund(1), 0)
  assert.equal(halfRefund(15), 7)
})
