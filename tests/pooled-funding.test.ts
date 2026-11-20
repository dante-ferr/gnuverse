import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPledge, quotePledge } from '../game-server/economy/pooled-funding.ts'

test('quotePledge rejects ineligible targets and over-payment', () => {
  assert.equal(quotePledge({ paid: 0, cost: 10, amount: 0, eligible: true }).ok, false)
  assert.equal(quotePledge({ paid: 0, cost: 10, amount: 5, eligible: false }).ok, false)
  const over = quotePledge({ paid: 8, cost: 10, amount: 5, eligible: true })
  assert.equal(over.ok, false)
  const ok = quotePledge({ paid: 3, cost: 10, amount: 4, eligible: true })
  assert.ok(ok.ok)
  if (ok.ok) assert.equal(ok.remaining, 7)
})

test('applyPledge accumulates backers and completes at cost', () => {
  const pledges: { key: string; paid: number; backers: { userId: string; amount: number }[] }[] =
    []
  const first = applyPledge(pledges, '1,2', 'a', 3, 10)
  assert.equal(first.completed, false)
  assert.equal(first.paid, 3)
  assert.equal(pledges[0]!.backers[0]!.amount, 3)
  const second = applyPledge(pledges, '1,2', 'a', 2, 10)
  assert.equal(second.completed, false)
  assert.equal(pledges[0]!.backers[0]!.amount, 5)
  const done = applyPledge(pledges, '1,2', 'b', 5, 10)
  assert.equal(done.completed, true)
  assert.equal(done.paid, 10)
  assert.equal(pledges.length, 0)
})