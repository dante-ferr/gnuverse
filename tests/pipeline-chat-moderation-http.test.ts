import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGameServer } from '../game-server/server.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

test('CMS chat moderators can list, delete, and clear room chat', async () => {
  let time = 3_000_000
  const previous = process.env.CMS_URL
  const cms = createServer((req, res) => {
    const cookie = req.headers.cookie ?? ''
    if (req.url === '/api/access-management/verify') {
      const allowed = cookie === 'payload-token=admin-session'
      res.writeHead(allowed ? 200 : 403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ allowed }))
      return
    }
    if (req.url === '/api/access-management/verify-chat-moderator') {
      const allowed =
        cookie === 'payload-token=admin-session' || cookie === 'payload-token=moderator-session'
      res.writeHead(allowed ? 200 : cookie ? 403 : 401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ allowed }))
      return
    }
    res.writeHead(404).end()
  })
  const folder = await mkdtemp(join(tmpdir(), 'gnuverse-chat-mod-'))
  const game = createGameServer({
    identityProvider: createTestIdentityProvider({ now: () => time }),
    dbPath: join(folder, 'game.sqlite'),
    now: () => time,
    rules: { chatCooldownMs: 0, pipeline: { tickMs: 250 } },
  })
  try {
    await new Promise<void>((resolve) => cms.listen(0, '127.0.0.1', resolve))
    process.env.CMS_URL = `http://127.0.0.1:${(cms.address() as AddressInfo).port}`
    const base = await game.listen()

    const register = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'torvalds',
        email: 'torvalds@example.org',
        password: 'test-password-123',
      }),
    })
    assert.equal(register.status, 201)
    const { token } = (await register.json()) as { token: string }
    const created = await fetch(`${base}/api/towers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sala moderada' }),
    })
    assert.equal(created.status, 201)
    const { room } = (await created.json()) as { room: { id: string } }

    for (const text of ['primeira', 'segunda', 'terceira']) {
      time += 1000
      const posted = await fetch(`${base}/api/towers/${room.id}/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      assert.equal(posted.status, 200)
    }

    assert.equal((await fetch(`${base}/api/admin/rooms`)).status, 401)
    assert.equal(
      (await fetch(`${base}/api/admin/rooms`, { headers: { cookie: 'payload-token=editor-session' } }))
        .status,
      403,
    )

    const listed = await fetch(`${base}/api/admin/rooms`, {
      headers: { cookie: 'payload-token=moderator-session' },
    })
    assert.equal(listed.status, 200)
    const rooms = (await listed.json()) as { rooms: { id: string; chatCount: number }[] }
    assert.equal(rooms.rooms[0]?.id, room.id)
    assert.equal(rooms.rooms[0]?.chatCount, 3)

    const detail = await fetch(`${base}/api/admin/rooms/${room.id}/chat`, {
      headers: { cookie: 'payload-token=moderator-session' },
    })
    assert.equal(detail.status, 200)
    const body = (await detail.json()) as { chat: { id: string; text: string }[] }
    assert.equal(body.chat.length, 3)
    const secondId = body.chat[1]!.id

    const deleted = await fetch(`${base}/api/admin/rooms/${room.id}/chat/${secondId}`, {
      method: 'DELETE',
      headers: { cookie: 'payload-token=moderator-session' },
    })
    assert.equal(deleted.status, 200)
    const afterDelete = (await deleted.json()) as { chat: { text: string }[] }
    assert.deepEqual(
      afterDelete.chat.map((message) => message.text),
      ['primeira', 'terceira'],
    )

    const cleared = await fetch(`${base}/api/admin/rooms/${room.id}/chat`, {
      method: 'DELETE',
      headers: { cookie: 'payload-token=admin-session' },
    })
    assert.equal(cleared.status, 200)
    const afterClear = (await cleared.json()) as { chat: unknown[]; removed: number }
    assert.equal(afterClear.removed, 2)
    assert.equal(afterClear.chat.length, 0)

    const publicDetail = await fetch(`${base}/api/towers/${room.id}`)
    const state = (await publicDetail.json()) as { chat: unknown[] }
    assert.equal(state.chat.length, 0)
  } finally {
    if (previous === undefined) delete process.env.CMS_URL
    else process.env.CMS_URL = previous
    await game.close()
    await new Promise<void>((resolve) => cms.close(() => resolve()))
    await rm(folder, { recursive: true, force: true })
  }
})
