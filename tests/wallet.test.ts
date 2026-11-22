import assert from 'node:assert/strict'
import test from 'node:test'
import { WalletService } from '../game-server/economy/wallet-service.ts'
import type { User } from '../game-server/domain/types.ts'
import { createRules } from '../game-server/runtime/rules.ts'

function user(roles: User['roles'], balance = 2): User {
  return {
    id: '1',
    nickname: 'player',
    email: 'player@example.org',
    roles,
    balance,
    coinAt: 0,
    lastAction: null,
  }
}

test('administrators have unlimited coins and never spend down stored balance', () => {
  const wallet = new WalletService(createRules(), () => 0)
  const admin = user(['admin', 'member'], 0)
  const view = wallet.read(admin)
  assert.equal(wallet.unlimited(admin), true)
  assert.equal(view.balance, Number.MAX_SAFE_INTEGER)
  assert.equal(admin.balance, 0)
})

test('members without admin role use the passive income cap', () => {
  const rules = createRules()
  const wallet = new WalletService(rules, () => 0)
  const member = user(['member'], 3)
  const view = wallet.read(member)
  assert.equal(wallet.unlimited(member), false)
  assert.equal(view.balance, 3)
  assert.equal(view.cap, rules.pipeline.passiveCap)
  assert.equal(view.absoluteCap, rules.pipeline.walletCap)
})

test('time income stops at the passive cap and refunds may sit above it', () => {
  let now = 0
  const rules = createRules({
    initialBalance: 0,
    pipeline: { passiveCap: 10, walletCap: 50, coinsPerMinute: 60 },
  })
  const wallet = new WalletService(rules, () => now)
  const member = user(['member'], 0)
  member.coinAt = 0
  now = 60_000
  const filled = wallet.read(member)
  assert.equal(filled.balance, 10)
  assert.equal(filled.nextCoinAt, null)
  assert.equal(member.balance, 10)

  const refunded = wallet.credit(member, 7)
  assert.equal(refunded.balance, 17)
  now = 120_000
  assert.equal(wallet.read(member).balance, 17)

  wallet.spend(member, 10)
  assert.equal(member.balance, 7)
  now += 5_000
  assert.equal(wallet.read(member).balance, 10)

  member.balance = 48
  assert.equal(wallet.credit(member, 10).balance, 50)
})

test('spend deducts member coins and leaves admin balance untouched', () => {
  const wallet = new WalletService(createRules(), () => 0)
  const member = user(['member'], 4)
  const after = wallet.spend(member, 2)
  assert.equal(after.balance, 2)
  assert.equal(member.balance, 2)
  const admin = user(['admin', 'member'], 0)
  const adminView = wallet.spend(admin, 99)
  assert.equal(adminView.balance, Number.MAX_SAFE_INTEGER)
  assert.equal(admin.balance, 0)
})