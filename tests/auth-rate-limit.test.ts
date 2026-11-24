import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage } from 'node:http'
import { clientAddress } from '../game-server/transport/http-helpers.ts'
import { fail } from '../game-server/domain/validation.ts'
import { createGameServer } from '../game-server/server.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

test('clientAddress prefers x-forwarded-for, then x-real-ip, then socket remoteAddress', () => {
  const makeReq = (headers: Record<string, string>, remoteAddress?: string) =>
    ({ headers, socket: { remoteAddress } }) as unknown as IncomingMessage

  assert.equal(
    clientAddress(makeReq({ 'x-forwarded-for': '198.51.100.2, 10.0.0.1' }, '10.0.0.1')),
    '198.51.100.2',
  )
  assert.equal(
    clientAddress(makeReq({ 'x-real-ip': '198.51.100.3' }, '10.0.0.1')),
    '198.51.100.3',
  )
  assert.equal(clientAddress(makeReq({}, '127.0.0.1')), '127.0.0.1')
  assert.equal(clientAddress(makeReq({})), 'unknown')
})

test('login rate limit isolates clients behind a proxy and does not count successful logins', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'gnuverse-auth-ratelimit-'))
  const dbPath = join(directory, 'game.sqlite')
  const identityProvider = createTestIdentityProvider()
  await identityProvider.register('admin@example.test', 'correct-password', 'admin')
  const game = createGameServer({ dbPath, now: () => 10_000, identityProvider })
  try {
    const base = await game.listen()

    // 20 successful logins from the same IP should never hit 429.
    for (let i = 0; i < 20; i += 1) {
      const res = await fetch(`${base}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '203.0.113.10, 10.0.0.1',
        },
        body: JSON.stringify({ email: 'admin@example.test', password: 'correct-password' }),
      })
      assert.equal(res.status, 200)
    }

    // 15 failed logins from client A fill client A's bucket; the 16th returns 429.
    for (let i = 0; i < 15; i += 1) {
      const res = await fetch(`${base}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '203.0.113.10, 10.0.0.1',
        },
        body: JSON.stringify({ email: 'admin@example.test', password: 'wrong-password' }),
      })
      assert.equal(res.status, 401)
    }
    const blocked = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.10, 10.0.0.1',
      },
      body: JSON.stringify({ email: 'admin@example.test', password: 'correct-password' }),
    })
    assert.equal(blocked.status, 429)

    // Client B behind the same proxy IP is unaffected and can still log in.
    const otherClient = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.99, 10.0.0.1',
      },
      body: JSON.stringify({ email: 'admin@example.test', password: 'correct-password' }),
    })
    assert.equal(otherClient.status, 200)
  } finally {
    await game.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('503 identity provider errors do not consume login rate-limit attempts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'gnuverse-auth-ratelimit-503-'))
  const dbPath = join(directory, 'game.sqlite')
  const baseProvider = createTestIdentityProvider()
  await baseProvider.register('admin@example.test', 'correct-password', 'admin')
  let unavailable = true
  const flakyProvider = {
    ...baseProvider,
    async login(identifier: string, password: string) {
      if (unavailable) {
        fail(503, 'Indisponível')
      }
      return baseProvider.login(identifier, password)
    },
    authenticate: baseProvider.authenticate.bind(baseProvider),
    register: baseProvider.register.bind(baseProvider),
    forgotPassword: baseProvider.forgotPassword.bind(baseProvider),
    resetPassword: baseProvider.resetPassword.bind(baseProvider),
    verifyEmail: baseProvider.verifyEmail.bind(baseProvider),
    logout: baseProvider.logout.bind(baseProvider),
  }
  const game = createGameServer({ dbPath, now: () => 10_000, identityProvider: flakyProvider })
  try {
    const base = await game.listen()
    for (let i = 0; i < 20; i += 1) {
      const res = await fetch(`${base}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.77' },
        body: JSON.stringify({ email: 'admin@example.test', password: 'correct-password' }),
      })
      assert.equal(res.status, 503)
    }
    unavailable = false
    const ok = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.77' },
      body: JSON.stringify({ email: 'admin@example.test', password: 'correct-password' }),
    })
    assert.equal(ok.status, 200)
  } finally {
    await game.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
