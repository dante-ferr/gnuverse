import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  assertProductionEmailEnv,
  buildSmtpTransportOptions,
  resolveSmtpSecure,
} from '../cms/src/email/smtp-transport.ts'
import { getSiteURL } from '../cms/src/email/site-url.ts'

test('SMTP secure defaults to port 465 unless SMTP_SECURE overrides', () => {
  assert.equal(resolveSmtpSecure({}, 465), true)
  assert.equal(resolveSmtpSecure({}, 587), false)
  assert.equal(resolveSmtpSecure({ SMTP_SECURE: 'true' }, 587), true)
  assert.equal(resolveSmtpSecure({ SMTP_SECURE: 'false' }, 465), false)
})

test('SMTP transport includes auth when SMTP_USER is set', () => {
  const options = buildSmtpTransportOptions({
    NODE_ENV: 'development',
    SMTP_HOST: 'smtp.example.test',
    SMTP_PORT: '587',
    SMTP_USER: 'mailer',
    SMTP_PASS: 'secret',
  })
  assert.deepEqual(options, {
    host: 'smtp.example.test',
    port: 587,
    secure: false,
    auth: { user: 'mailer', pass: 'secret' },
  })
})

test('production email env requires SMTP host, from address, and public site URL', () => {
  assert.throws(
    () => assertProductionEmailEnv({ NODE_ENV: 'production' }),
    /SMTP_HOST/,
  )
  assert.throws(
    () => getSiteURL({ NODE_ENV: 'production' }),
    /GNUVERSE_SITE_URL/,
  )
  assert.doesNotThrow(() =>
    assertProductionEmailEnv({
      NODE_ENV: 'production',
      SMTP_HOST: 'smtp.example.test',
      SMTP_FROM_ADDRESS: 'noreply@example.test',
      GNUVERSE_SITE_URL: 'https://gnuverse.example',
    }),
  )
})
