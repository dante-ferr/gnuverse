import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readHostAdminCredentials } from '../cms/src/identity/host-admin-credentials.ts'

test('readHostAdminCredentials validates HOST_ADMIN_* values', () => {
  assert.deepEqual(
    readHostAdminCredentials({
      HOST_ADMIN_EMAIL: 'Admin@Example.TEST',
      HOST_ADMIN_PASSWORD: 'prod-secret',
      HOST_ADMIN_NAME: 'Ada',
      HOST_ADMIN_USERNAME: 'Ada_Admin',
    }),
    {
      email: 'admin@example.test',
      password: 'prod-secret',
      name: 'Ada',
      username: 'ada_admin',
    },
  )
  assert.throws(
    () => readHostAdminCredentials({ HOST_ADMIN_EMAIL: 'nope', HOST_ADMIN_PASSWORD: 'x' }),
    /e-mail/,
  )
})
