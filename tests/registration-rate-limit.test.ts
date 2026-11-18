import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  consumeRegistrationAttempt,
  registrationClientKey,
  resetRegistrationRateLimit,
} from '../cms/src/identity/registration-rate-limit.ts'

test('registration rate limit blocks after the window fills', () => {
  resetRegistrationRateLimit()
  const key = '203.0.113.10'
  for (let i = 0; i < 10; i += 1) {
    assert.equal(consumeRegistrationAttempt(key, 1_000 + i, { maxAttempts: 10, windowMs: 60_000 }).ok, true)
  }
  const blocked = consumeRegistrationAttempt(key, 1_020, { maxAttempts: 10, windowMs: 60_000 })
  assert.equal(blocked.ok, false)
  if (!blocked.ok) assert.ok(blocked.retryAfterSeconds >= 1)
})

test('registration client key prefers x-forwarded-for', () => {
  assert.equal(
    registrationClientKey(new Headers({ 'x-forwarded-for': '198.51.100.2, 10.0.0.1' })),
    '198.51.100.2',
  )
  assert.equal(registrationClientKey(new Headers({ 'x-real-ip': '198.51.100.3' })), '198.51.100.3')
})
