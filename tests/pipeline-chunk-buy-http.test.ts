import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGameServer } from '../game-server/server.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

test('players can buy an edge-adjacent preview chunk with coins', async () => {
  let time = 1_000_000
  const folder = await mkdtemp(join(tmpdir(), 'gnuverse-chunk-buy-'))
  const identityProvider = createTestIdentityProvider({ now: () => time })
  const game = createGameServer({
    identityProvider,
    dbPath: join(folder, 'game.sqlite'),
    now: () => time,
    rules: {
      initialBalance: 5,
      pipeline: {
        tickMs: 250,
        chunkCostBase: 5,
        chunkCostStep: 2,
        passiveCap: 5,
        walletCap: 1_000_000,
      },
    },
  })
  const base = await game.listen()
  try {
    const register = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'comprador',
        email: 'buyer@example.org',
        password: 'test-password-123',
      }),
    })
    assert.equal(register.status, 201)
    const { token } = (await register.json()) as { token: string }
    const created = await fetch(`${base}/api/rooms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Expansão' }),
    })
    assert.ok(created.status === 200 || created.status === 201)
    const { room } = (await created.json()) as { room: { id: string } }
    const detail = await fetch(`${base}/api/rooms/${room.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const payload = (await detail.json()) as {
      frame: {
        ownedChunks: { cx: number; cy: number }[]
        previewChunks: { cx: number; cy: number }[]
      }
    }
    const target = payload.frame.previewChunks[0]!
    const partial = await fetch(`${base}/api/rooms/${room.id}/buy-chunk`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...target, amount: 2 }),
    })
    assert.equal(partial.status, 200)
    const partialBody = (await partial.json()) as {
      frame: { ownedChunks: { cx: number; cy: number }[]; chunkPledges?: { paid: number }[] }
      wallet: { balance: number }
      completed: boolean
    }
    assert.equal(partialBody.completed, false)
    assert.equal(partialBody.wallet.balance, 3)
    assert.equal(partialBody.frame.ownedChunks.length, 1)
    assert.equal(partialBody.frame.chunkPledges?.[0]?.paid, 2)

    const bought = await fetch(`${base}/api/rooms/${room.id}/buy-chunk`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...target, amount: 3 }),
    })
    assert.equal(bought.status, 200)
    const body = (await bought.json()) as {
      frame: { ownedChunks: { cx: number; cy: number }[] }
      wallet: { balance: number }
      cost: number
      completed: boolean
    }
    assert.equal(body.completed, true)
    assert.equal(body.cost, 5)
    assert.equal(body.wallet.balance, 0)
    assert.equal(body.frame.ownedChunks.length, 2)
    assert.ok(body.frame.ownedChunks.some((c) => c.cx === target.cx && c.cy === target.cy))

    const broke = await fetch(`${base}/api/rooms/${room.id}/buy-chunk`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body.frame.ownedChunks[0], amount: 1 }),
    })
    // After one buy, owned starter is no longer a preview target.
    assert.equal(broke.status, 409)

    const nextPreview = (
      (await (
        await fetch(`${base}/api/rooms/${room.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).json()) as { frame: { previewChunks: { cx: number; cy: number }[] } }
    ).frame.previewChunks[0]!
    const poor = await fetch(`${base}/api/rooms/${room.id}/buy-chunk`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...nextPreview, amount: 1 }),
    })
    assert.equal(poor.status, 402)
  } finally {
    await game.close()
    await rm(folder, { recursive: true, force: true })
  }
})
