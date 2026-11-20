import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGameServer } from '../game-server/server.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

test('only administrators can advance the pipeline version', async () => {
  let time = 1_000_000
  const folder = await mkdtemp(join(tmpdir(), 'gnuverse-pipeline-unlock-'))
  const admins = new Set<string>()
  const identityProvider = createTestIdentityProvider({
    now: () => time,
    roles: (profileId) => (admins.has(profileId) ? ['admin', 'member'] : ['member']),
  })
  const game = createGameServer({
    identityProvider,
    dbPath: join(folder, 'game.sqlite'),
    now: () => time,
    rules: { pipeline: { tickMs: 250 } },
  })
  const base = await game.listen()
  try {
    const memberRegister = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'membro',
        email: 'member@example.org',
        password: 'test-password-123',
      }),
    })
    const memberBody = (await memberRegister.json()) as { token: string; user: { id: string } }
    const memberToken = memberBody.token
    const created = await fetch(`${base}/api/rooms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Versão' }),
    })
    const { room } = (await created.json()) as { room: { id: string } }
    const denied = await fetch(`${base}/api/rooms/${room.id}/advance`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    assert.equal(denied.status, 403)
    admins.add(memberBody.user.id)
    const advanced = await fetch(`${base}/api/rooms/${room.id}/advance`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    assert.equal(advanced.status, 200)
    const payload = (await advanced.json()) as { frame: { version: string } }
    assert.equal(payload.frame.version, '0.2')
  } finally {
    await game.close()
    await rm(folder, { recursive: true, force: true })
  }
})