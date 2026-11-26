import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { packPackets, unpackPackets } from '../core/wire/packets.ts'
import { createGameServer } from '../game-server/server.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

test('packed packets round-trip and fall back on unexpected ids', () => {
  const packets = [
    { id: 'p1', x: 3, y: 4, shape: 'fire' },
    { id: 'p22', x: -1, y: 0, shape: 'water' },
    { id: 'p7', x: 9, y: 9, shape: 'fire' },
  ]
  const packed = packPackets(packets)
  assert.deepEqual(packed?.shapes, ['fire', 'water'])
  assert.deepEqual(unpackPackets(packed!), packets)
  assert.equal(packPackets([{ id: 'legacy', x: 0, y: 0, shape: 'fire' }]), null)
})

test('room detail omits the event log; player history is served per actor', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'gnuverse-wire-'))
  const game = createGameServer({
    identityProvider: createTestIdentityProvider(),
    dbPath: join(folder, 'game.sqlite'),
    rules: { pipeline: { tickMs: 250 } },
  })
  const base = await game.listen()
  try {
    const register = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'ada', email: 'ada@example.org', password: 'test-password-123' }),
    })
    const { token, user } = (await register.json()) as { token: string; user: { id: string } }
    const created = await fetch(`${base}/api/rooms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Histórico' }),
    })
    const { room } = (await created.json()) as { room: { id: string } }

    const detail = await fetch(`${base}/api/rooms/${room.id}`)
    assert.equal(detail.headers.get('content-encoding'), 'gzip')
    const state = (await detail.json()) as Record<string, unknown>
    assert.equal('events' in state, false)

    const history = await fetch(
      `${base}/api/rooms/${room.id}/members/${encodeURIComponent(user.id)}/history`,
    )
    assert.equal(history.status, 200)
    const { events } = (await history.json()) as { events: { type: string; actorId: string }[] }
    assert.ok(events.some((event) => event.type === 'created'))
    assert.ok(events.every((event) => event.actorId === user.id))

    const stranger = await fetch(`${base}/api/rooms/${room.id}/members/nobody/history`)
    assert.deepEqual(((await stranger.json()) as { events: unknown[] }).events, [])
    const malformed = await fetch(`${base}/api/rooms/${room.id}/members/%E0%A4%A/history`)
    assert.equal(malformed.status, 400)
  } finally {
    await game.close()
    await rm(folder, { recursive: true, force: true })
  }
})
