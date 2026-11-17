import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGameServer } from '../game-server/server.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

test('a signed-in player can belt a circle into the core and a guest cannot', async () => {
  let time = 1_000_000
  const folder = await mkdtemp(join(tmpdir(), 'gnuverse-pipeline-'))
  const identityProvider = createTestIdentityProvider({ now: () => time })
  const game = createGameServer({
    identityProvider,
    dbPath: join(folder, 'game.sqlite'),
    now: () => time,
    rules: { pipeline: { tickMs: 250 } },
  })
  const base = await game.listen()
  try {
    const register = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'ada',
        email: 'ada@example.org',
        password: 'test-password-123',
      }),
    })
    assert.equal(register.status, 201)
    const { token } = (await register.json()) as { token: string }
    const created = await fetch(`${base}/api/towers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Núcleo' }),
    })
    assert.equal(created.status, 201)
    const { room } = (await created.json()) as { room: { id: string } }
    const detail = await fetch(`${base}/api/towers/${room.id}`)
    const state = (await detail.json()) as {
      frame: {
        source: { x: number; y: number }
        core: { x: number; y: number }
        collaborators: { id: string }[]
      }
    }
    const guest = await fetch(`${base}/api/towers/${room.id}/place`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cells: [{ x: 0, y: 0, direction: 'east' }] }),
    })
    assert.equal(guest.status, 401)
    const { source, core } = state.frame
    const y = source.y + 1
    const cells = []
    for (let x = source.x + 3; x < core.x; x++) cells.push({ x, y, direction: 'east' })
    const placed = await fetch(`${base}/api/towers/${room.id}/place`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cells }),
    })
    assert.equal(placed.status, 200)
    const joined = await fetch(`${base}/api/towers/${room.id}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    const body = (await joined.json()) as { frame: { collaborators: { nickname: string }[]; belts: unknown[] } }
    assert.equal(body.frame.collaborators[0]?.nickname, 'ada')
    assert.ok(body.frame.belts.length >= 2)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    const later = await fetch(`${base}/api/towers/${room.id}`)
    const after = (await later.json()) as { frame: { deliveries: number } }
    assert.ok(after.frame.deliveries > 0)
  } finally {
    await game.close()
    await rm(folder, { recursive: true, force: true })
  }
})
