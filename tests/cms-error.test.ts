import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { cmsErrorMessage } from '../game-server/auth/cms-error.ts'
import { CMSIdentityProvider } from '../game-server/auth/cms-identity-provider.ts'
import { HttpError } from '../game-server/domain/validation.ts'

test('cmsErrorMessage reads Payload error envelopes', () => {
  assert.equal(cmsErrorMessage({ error: 'Cadastro falhou.' }, 'fallback'), 'Cadastro falhou.')
  assert.equal(
    cmsErrorMessage({ errors: [{ message: 'Verification token is invalid.' }] }, 'fallback'),
    'Verification token is invalid.',
  )
  assert.equal(cmsErrorMessage({}, 'fallback'), 'fallback')
})

test('verifyEmail uses the idempotent identity endpoint and returns its message', async () => {
  const server = createServer((req, res) => {
    assert.equal(req.url, '/api/identity/verify-email')
    assert.equal(req.method, 'POST')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'E-mail confirmado. Agora você já pode entrar.', confirmed: true }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const { port } = server.address() as AddressInfo
    const provider = new CMSIdentityProvider(`http://127.0.0.1:${port}`)
    const result = await provider.verifyEmail('a'.repeat(20))
    assert.deepEqual(result, { message: 'E-mail confirmado. Agora você já pode entrar.' })
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test('login surfaces Payload 403 confirmation errors instead of a generic 503', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ errors: [{ message: 'Confirme seu e-mail antes de entrar.' }] }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const { port } = server.address() as AddressInfo
    const provider = new CMSIdentityProvider(`http://127.0.0.1:${port}`)
    await assert.rejects(
      () => provider.login('user@example.test', 'secret'),
      (error: unknown) =>
        error instanceof HttpError &&
        error.status === 403 &&
        error.message === 'Confirme seu e-mail antes de entrar.',
    )
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
