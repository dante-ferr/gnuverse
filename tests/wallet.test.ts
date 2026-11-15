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

test('members without admin role use the normal wallet cap', () => {
  const wallet = new WalletService(createRules(), () => 0)
  const member = user(['member'], 3)
  const view = wallet.read(member)
  assert.equal(wallet.unlimited(member), false)
  assert.equal(view.balance, 3)
  assert.equal(view.cap, 5)
})