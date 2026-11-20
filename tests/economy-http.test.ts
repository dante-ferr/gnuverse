import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGameServer } from '../game-server/server.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

test('belt placement spends coins, same-speed redraws are free, and delete refunds half', async () => {
  const time = 1_000_000
  const folder = await mkdtemp(join(tmpdir(), 'gnuverse-economy-'))
  const identityProvider = createTestIdentityProvider({ now: () => time })
  const game = createGameServer({
    identityProvider,
    dbPath: join(folder, 'game.sqlite'),
    now: () => time,
    rules: {
      initialBalance: 30,
      pipeline: { passiveCap: 30, walletCap: 1_000, tickMs: 250 },
    },
  })
  const base = await game.listen()
  try {
    const register = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'builder',
        email: 'builder@example.org',
        password: 'test-password-123',
      }),
    })
    assert.equal(register.status, 201)
    const { token } = (await register.json()) as { token: string }
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const created = await fetch(`${base}/api/towers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Custos' }),
    })
    assert.ok(created.status === 200 || created.status === 201)
    const { room } = (await created.json()) as { room: { id: string } }
    const detail = await fetch(`${base}/api/towers/${room.id}`, { headers })
    const payload = (await detail.json()) as { frame: { core: { x: number; y: number } } }
    const cell = { x: payload.frame.core.x + 6, y: payload.frame.core.y, direction: 'east' as const }

    const placed = await fetch(`${base}/api/towers/${room.id}/place`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ cells: [cell] }),
    })
    assert.equal(placed.status, 200)
    const placedBody = (await placed.json()) as { wallet: { balance: number }; cost: number }
    assert.equal(placedBody.cost, 1)
    assert.equal(placedBody.wallet.balance, 29)

    const redraw = await fetch(`${base}/api/towers/${room.id}/place`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ cells: [{ ...cell, direction: 'north' }] }),
    })
    assert.equal(redraw.status, 200)
    const redrawBody = (await redraw.json()) as { wallet: { balance: number }; cost: number }
    assert.equal(redrawBody.cost, 0)
    assert.equal(redrawBody.wallet.balance, 29)

    const upgraded = await fetch(`${base}/api/towers/${room.id}/place`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ cells: [cell], speed: 3 }),
    })
    assert.equal(upgraded.status, 200)
    const upgradedBody = (await upgraded.json()) as { wallet: { balance: number }; cost: number }
    assert.equal(upgradedBody.cost, 4)
    assert.equal(upgradedBody.wallet.balance, 25)

    const removed = await fetch(`${base}/api/towers/${room.id}/remove`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ x: cell.x, y: cell.y }),
    })
    assert.equal(removed.status, 200)
    const removedBody = (await removed.json()) as { wallet: { balance: number }; refund: number }
    assert.equal(removedBody.refund, 2)
    assert.equal(removedBody.wallet.balance, 27)
  } finally {
    await game.close()
    await rm(folder, { recursive: true, force: true })
  }
})
