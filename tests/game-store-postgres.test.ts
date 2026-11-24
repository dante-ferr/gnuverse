import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GameStore, type PostgresPoolLike } from '../game-server/persistence/game-store.ts'
import { createGameServer } from '../game-server/server.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

function createFakePostgresPool(initialValue?: string) {
  let stored = initialValue
  let ended = false
  const queries: Array<{ text: string; values?: unknown[] }> = []
  let writeGate: Promise<void> | null = null
  let releaseWriteGate: (() => void) | null = null

  const pool: PostgresPoolLike = {
    async query(text: string, values?: unknown[]) {
      queries.push({ text, values })
      if (text.startsWith('SELECT value FROM game_state')) {
        return { rows: stored ? [{ value: stored }] : [] }
      }
      if (text.startsWith('INSERT INTO game_state')) {
        if (writeGate) await writeGate
        stored = String(values?.[0] ?? '')
        return { rows: [] }
      }
      return { rows: [] }
    },
    async end() {
      ended = true
    },
  }

  return {
    pool,
    queries,
    readStored: () => stored,
    isEnded: () => ended,
    pauseWrites() {
      writeGate = new Promise((resolve) => {
        releaseWriteGate = resolve
      })
    },
    resumeWrites() {
      writeGate = null
      releaseWriteGate?.()
      releaseWriteGate = null
    },
  }
}

test('GameStore Postgres backend loads state, coalesces writes, rolls back, and flushes on close', async () => {
  const initial = JSON.stringify({
    users: {
      u1: {
        id: 'u1',
        nickname: 'alice',
        email: 'alice@example.test',
        balance: 42,
        coinAt: 1000,
        lastAction: null,
      },
    },
    sessions: {},
    rooms: {},
  })
  const fake = createFakePostgresPool(initial)
  const store = await GameStore.fromPostgresPool(fake.pool)

  assert.equal(store.state.users.u1?.balance, 42)
  assert.ok(fake.queries[0]?.text.includes('CREATE TABLE IF NOT EXISTS game_state'))

  // Rollback restores state without persisting the failed mutation.
  let rolledBack = false
  store.onRollback = () => {
    rolledBack = true
  }
  assert.throws(() => {
    store.atomic(() => {
      store.state.users.u1!.balance = 999
      throw new Error('boom')
    })
  }, /boom/)
  assert.equal(rolledBack, true)
  assert.equal(store.state.users.u1?.balance, 42)

  // Rapid updates while a write is in flight coalesce into the latest snapshot.
  fake.pauseWrites()
  store.atomic(() => {
    store.state.users.u1!.balance = 50
  })
  store.atomic(() => {
    store.state.users.u1!.balance = 75
  })
  fake.resumeWrites()

  await store.close()
  assert.equal(fake.isEnded(), true)
  const saved = JSON.parse(fake.readStored()!)
  assert.equal(saved.users.u1.balance, 75)
})

test('createGameServer works with a Postgres-backed GameStore', async () => {
  const fake = createFakePostgresPool()
  const store = await GameStore.fromPostgresPool(fake.pool)
  const identityProvider = createTestIdentityProvider()
  await identityProvider.register('player@example.test', 'secret-pass', 'player')

  const game = createGameServer({ store, now: () => 5000, identityProvider })
  try {
    const base = await game.listen()
    const res = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player@example.test', password: 'secret-pass' }),
    })
    assert.equal(res.status, 200)
  } finally {
    await game.close()
  }

  assert.equal(fake.isEnded(), true)
  const saved = JSON.parse(fake.readStored()!)
  assert.equal(Object.keys(saved.users).length, 1)
})
