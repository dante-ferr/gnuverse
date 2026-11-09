import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scryptSync } from 'node:crypto'
import { GameStore } from '../game-server/persistence/game-store.ts'
import { createGameServer } from '../game-server/server.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

for (const samePassword of [true, false]) {
  test(samePassword ? 'legacy profile migrates after proof of both accounts without losing its ID or balance'
    : 'matching email alone cannot claim an old game profile', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'gnuverse-identity-migration-'))
    const dbPath = join(directory, 'game.sqlite')
    const store = new GameStore(dbPath)
    const password = 'legacy-test-password'
    store.state.users['legacy-id'] = { id: 'legacy-id', nickname: 'legacy-player', email: 'legacy@example.test',
      salt: 'fixture-salt', password: scryptSync(password, 'fixture-salt', 64).toString('hex'), balance: 7, coinAt: 1000, lastAction: null }
    store.persist(); store.close()
    const identityProvider = createTestIdentityProvider()
    const canonicalPassword = samePassword ? password : 'different-issuer-password'
    await identityProvider.register('legacy@example.test', canonicalPassword, 'canonical-player')
    const game = createGameServer({ dbPath, now: () => 1000, identityProvider })
    try {
      const base = await game.listen()
      const response = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'legacy@example.test', password: canonicalPassword }) })
      assert.equal(response.status, samePassword ? 200 : 409)
      if (samePassword) {
        const data = await response.json()
        assert.equal(data.user.id, 'legacy-id')
        assert.equal(data.user.nickname, 'legacy-player')
        assert.equal(data.wallet.balance, 7)
      }
      await game.close()
      const saved = new GameStore(dbPath)
      assert.equal(Object.keys(saved.state.users).length, 1)
      assert.equal(Boolean(saved.state.users['legacy-id'].identity), samePassword)
      assert.equal(saved.state.users['legacy-id'].password === undefined, samePassword)
      saved.close()
    } finally { await game.close(); rmSync(directory, { recursive: true, force: true }) }
  })
}
