import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGameServer } from '../game-server/server.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

test('non-admins may create at most maxRoomsPerCreator rooms; admins are uncapped', async () => {
  let time = 1_000_000
  const folder = await mkdtemp(join(tmpdir(), 'gnuverse-room-limit-'))
  const admins = new Set<string>()
  const identityProvider = createTestIdentityProvider({
    now: () => time,
    roles: (profileId) => (admins.has(profileId) ? ['admin', 'member'] : ['member']),
  })
  const game = createGameServer({
    identityProvider,
    dbPath: join(folder, 'game.sqlite'),
    now: () => time,
    rules: { maxRoomsPerCreator: 3, pipeline: { tickMs: 250 } },
  })
  const base = await game.listen()
  try {
    const register = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'criador',
        email: 'creator@example.org',
        password: 'test-password-123',
      }),
    })
    assert.equal(register.status, 201)
    const body = (await register.json()) as { token: string; user: { id: string } }
    const headers = {
      Authorization: `Bearer ${body.token}`,
      'Content-Type': 'application/json',
    }
    for (let index = 0; index < 3; index += 1) {
      const created = await fetch(`${base}/api/rooms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: `Sala ${index + 1}` }),
      })
      assert.equal(created.status, 201)
    }
    const blocked = await fetch(`${base}/api/rooms`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Sala extra' }),
    })
    assert.equal(blocked.status, 409)
    const blockedBody = (await blocked.json()) as { error: string }
    assert.match(blockedBody.error, /máximo de salas/i)

    admins.add(body.user.id)
    const allowed = await fetch(`${base}/api/rooms`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Sala admin' }),
    })
    assert.equal(allowed.status, 201)
  } finally {
    await game.close()
    await rm(folder, { recursive: true, force: true })
  }
})
