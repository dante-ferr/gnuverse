import assert from 'node:assert/strict'
import test from 'node:test'
import { authenticateViaCms, resolveCmsBaseUrl } from '../src/lib/cms-client.ts'

test('resolveCmsBaseUrl usa URL configurada, localhost em dev e null em produção sem variável', () => {
  assert.equal(
    resolveCmsBaseUrl('https://cms.gnuverse.test/', 'gnuverse.vercel.app'),
    'https://cms.gnuverse.test',
  )
  assert.equal(resolveCmsBaseUrl('', 'localhost'), 'http://localhost:3001')
  assert.equal(resolveCmsBaseUrl(undefined, '127.0.0.1'), 'http://localhost:3001')
  const previousPort = process.env.CMS_PORT
  process.env.CMS_PORT = '3004'
  try {
    assert.equal(resolveCmsBaseUrl('', 'localhost'), 'http://localhost:3004')
  } finally {
    if (previousPort === undefined) delete process.env.CMS_PORT
    else process.env.CMS_PORT = previousPort
  }
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
    assert.deepEqual(calls[0]?.body, { email: 'ana@gnuverse.local', password: '123' })
    assert.equal(calls[1]?.url, 'https://cms.gnuverse.test/api/identity/register')

    const usernameLogin = await authenticateViaCms('https://cms.gnuverse.test', 'login', {
      email: 'ana_autora',
      password: '123',
    })
    assert.deepEqual(usernameLogin, {
      verificationRequired: false,
      token: 'cms-jwt-token',
    })
    assert.deepEqual(calls[2]?.body, { username: 'ana_autora', password: '123' })
  } finally {
    globalThis.fetch = originalFetch
  }
})
