import assert from 'node:assert/strict'
import test from 'node:test'
import { authenticateViaCms, resolveCmsBaseUrl } from '../src/lib/cms-client.ts'
import { GameApi, resolveGameApiUrl } from '../src/components/game/api/game-api.ts'

test('resolveCmsBaseUrl usa URL configurada, localhost em dev e null em produção sem variável', () => {
  assert.equal(
    resolveCmsBaseUrl('https://cms.gnuverse.test/', 'gnuverse.vercel.app'),
    'https://cms.gnuverse.test',
  )
  assert.equal(resolveCmsBaseUrl('', 'localhost'), 'http://localhost:3001')
  assert.equal(resolveCmsBaseUrl(undefined, '127.0.0.1'), 'http://localhost:3001')
  assert.equal(resolveCmsBaseUrl('', 'gnuverse.vercel.app'), null)
})

test('authenticateViaCms autentica login e cadastro direto no CMS sem game-server', async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ url: string; body: unknown }> = []

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const body = init?.body ? JSON.parse(String(init.body)) : null
    calls.push({ url, body })

    if (url.endsWith('/api/users/login')) {
      return new Response(JSON.stringify({ token: 'cms-jwt-token' }), { status: 200 })
    }
    if (url.endsWith('/api/identity/register')) {
      return new Response(
        JSON.stringify({
          verificationRequired: true,
          message: 'Confirme seu e-mail.',
        }),
        { status: 201 },
      )
    }
    return new Response('{}', { status: 404 })
  }) as typeof fetch

  try {
    const loginResult = await authenticateViaCms('https://cms.gnuverse.test', 'login', {
      email: 'ana@gnuverse.local',
      password: '123',
    })
    assert.deepEqual(loginResult, {
      verificationRequired: false,
      token: 'cms-jwt-token',
    })

    const registerResult = await authenticateViaCms('https://cms.gnuverse.test', 'register', {
      email: 'ana@gnuverse.local',
      password: '123',
      nickname: 'ana',
    })
    assert.deepEqual(registerResult, {
      verificationRequired: true,
      message: 'Confirme seu e-mail.',
    })

    assert.equal(calls[0]?.url, 'https://cms.gnuverse.test/api/users/login')
    assert.equal(calls[1]?.url, 'https://cms.gnuverse.test/api/identity/register')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('resolveGameApiUrl usa URL configurada, localhost em dev e null em produção sem variável', () => {
  assert.equal(
    resolveGameApiUrl('https://game.gnuverse.test/', 'gnuverse.vercel.app'),
    'https://game.gnuverse.test',
  )
  assert.equal(resolveGameApiUrl('', 'localhost'), 'http://localhost:3002')
  assert.equal(resolveGameApiUrl(undefined, '127.0.0.1'), 'http://localhost:3002')
  assert.equal(resolveGameApiUrl('', 'gnuverse.vercel.app'), null)
})

test('authenticateViaCms e GameApi traduzem falhas de rede para português', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  globalThis.fetch = (async () => {
    throw new TypeError('NetworkError when attempting to fetch resource.')
  }) as typeof fetch

  try {
    await assert.rejects(
      () =>
        authenticateViaCms('https://cms.gnuverse.test', 'register', {
          email: 'ana@gnuverse.local',
          password: '123',
          nickname: 'ana',
        }),
      /Não foi possível conectar ao servidor editorial \(CMS\)/,
    )

    const api = new GameApi('', () => {})
    await assert.rejects(
      () => api.request('/api/register', { email: 'ana@gnuverse.local' }),
      /Não foi possível conectar ao servidor do jogo/,
    )

    Object.defineProperty(globalThis, 'window', {
      value: { location: { hostname: 'gnuverse.vercel.app' } },
      configurable: true,
    })
    await assert.rejects(
      () => api.request('/api/register', { email: 'ana@gnuverse.local' }),
      /O servidor do jogo ainda não foi configurado neste ambiente/,
    )
  } finally {
    globalThis.fetch = originalFetch
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window
    } else {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
      })
    }
  }
})
