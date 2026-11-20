import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGameServer } from '../game-server/server.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

test('signed-in players post room chat; guests cannot; SSE receives chat', async () => {
  let time = 2_000_000
  const folder = await mkdtemp(join(tmpdir(), 'gnuverse-chat-'))
  const identityProvider = createTestIdentityProvider({ now: () => time })
  const game = createGameServer({
    identityProvider,
    dbPath: join(folder, 'game.sqlite'),
    now: () => time,
    rules: {
      chatCooldownMs: 0,
      chatHistoryLimit: 50,
      chatMessageMaxLength: 120,
      pipeline: { tickMs: 250 },
    },
  })
  const base = await game.listen()
  try {
    const register = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'linus',
        email: 'linus@example.org',
        password: 'test-password-123',
      }),
    })
    assert.equal(register.status, 201)
    const { token } = (await register.json()) as { token: string }
    const created = await fetch(`${base}/api/rooms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sala chat' }),
    })
    assert.equal(created.status, 201)
    const { room } = (await created.json()) as { room: { id: string } }

    const guest = await fetch(`${base}/api/rooms/${room.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'oi' }),
    })
    assert.equal(guest.status, 401)

    const events = await fetch(`${base}/api/rooms/${room.id}/events`)
    assert.equal(events.status, 200)
    const reader = events.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const readUntilChat = async (predicate: (chat: unknown[]) => boolean) => {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) throw new Error('SSE closed before chat event')
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''
        for (const chunk of chunks) {
          if (!chunk.includes('event: chat')) continue
          const line = chunk.split('\n').find((entry) => entry.startsWith('data: '))
          if (!line) continue
          const payload = JSON.parse(line.slice(6)) as { chat: unknown[] }
          if (predicate(payload.chat)) return payload.chat
        }
      }
    }
    await readUntilChat((chat) => Array.isArray(chat) && chat.length === 0)

    const posted = await fetch(`${base}/api/rooms/${room.id}/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'olá núcleo' }),
    })
    assert.equal(posted.status, 200)
    const body = (await posted.json()) as {
      message: { text: string; authorNickname: string }
      chat: { text: string }[]
    }
    assert.equal(body.message.text, 'olá núcleo')
    assert.equal(body.message.authorNickname, 'linus')
    assert.equal(body.chat.length, 1)

    const live = await readUntilChat((chat) => chat.length === 1)
    assert.equal((live[0] as { text: string }).text, 'olá núcleo')

    const detail = await fetch(`${base}/api/rooms/${room.id}`)
    const state = (await detail.json()) as { chat: { text: string }[] }
    assert.equal(state.chat[0]?.text, 'olá núcleo')

    reader.cancel()
  } finally {
    await game.close()
    await rm(folder, { recursive: true, force: true })
  }
})
