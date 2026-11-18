import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import {
  confirmationEmailFailureMessage,
  isEmailDeliveryError,
} from '../cms/src/email/delivery.ts'
import { CMSIdentityProvider } from '../game-server/auth/cms-identity-provider.ts'
import { HttpError } from '../game-server/domain/validation.ts'

test('email delivery errors include Nodemailer connection failures', () => {
  assert.equal(isEmailDeliveryError({ code: 'ESOCKET', message: 'connect ECONNREFUSED 127.0.0.1:1025' }), true)
  assert.equal(isEmailDeliveryError({ cause: { code: 'ETIMEDOUT', message: 'timeout' } }), true)
  assert.equal(isEmailDeliveryError(new Error('username is taken')), false)
})

test('local confirmation failure tells you to open Mailpit', () => {
  assert.match(confirmationEmailFailureMessage('development'), /make mailpit/)
  assert.match(confirmationEmailFailureMessage('development'), /URL do inbox/)
  assert.doesNotMatch(confirmationEmailFailureMessage('production'), /mailpit/i)
})

test('register forwards the CMS confirmation failure instead of a generic account error', async () => {
  const message = confirmationEmailFailureMessage('development')
  const server = createServer((_req, res) => {
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: message }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const { port } = server.address() as AddressInfo
    const provider = new CMSIdentityProvider(`http://127.0.0.1:${port}`)
    await assert.rejects(
      () => provider.register('b@b.com', 'secret-password', 'bbb'),
      (error: unknown) => error instanceof HttpError && error.status === 503 && error.message === message,
    )
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
