import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getPayload, handleEndpoints } from 'payload'
import { markLegacyAccountsVerified } from '../src/identity/legacy-verification.ts'

const directory = await mkdtemp(path.join(os.tmpdir(), 'gnuverse-legacy-account-'))
Object.assign(process.env, {
  NODE_ENV: 'development',
  PAYLOAD_SECRET: randomBytes(32).toString('hex'),
  DATABASE_ADAPTER: 'sqlite',
  DATABASE_URL: `file:${path.join(directory, 'test.db')}`,
  STORAGE_ADAPTER: 'local',
  CMS_PORT: '3999',
  GNUVERSE_DATA_DIR: directory,
  EMAIL_VERIFICATION: 'true',
  HOST_ADMIN_EMAIL: 'host@example.test',
  HOST_ADMIN_PASSWORD: 'host-admin-password',
  HOST_ADMIN_NAME: 'Host Admin',
  HOST_ADMIN_USERNAME: 'host_admin',
})
delete process.env.GNUVERSE_AUTHZ_FILE

const { default: config } = await import('../src/payload.config.ts')
const payload = await getPayload({ config })
let exitCode = 0

try {
  assert.equal(typeof payload.collections.users.config.auth === 'object' && payload.collections.users.config.auth.verify !== false, true)
  const password = 'legacy-admin-password'
  const admin = await payload.create({
    collection: 'users',
    disableVerificationEmail: true,
    data: { name: 'Admin anterior', username: 'admin_anterior', email: 'legacy@example.test', password, role: 'admin', _verified: true },
  })
  await payload.db.updateOne({ id: admin.id, collection: 'users', data: { _verified: null }, returning: false })
  const before = await payload.findByID({ collection: 'users', id: admin.id, overrideAccess: true })
  assert.equal(before._verified, null)

  await markLegacyAccountsVerified(payload)
  const confirmed = await payload.findByID({ collection: 'users', id: admin.id, overrideAccess: true })
  assert.equal(confirmed._verified, true, 'Conta anterior à confirmação de e-mail precisa ficar confirmada na inicialização')

  const login = await payload.login({ collection: 'users', data: { email: admin.email, password } })
  assert.equal(typeof login.token, 'string')
  const usernameLogin = await payload.login({ collection: 'users', data: { username: 'admin_anterior', password } })
  assert.equal(typeof usernameLogin.token, 'string', 'Login pelo apelido público precisa autenticar a mesma conta')

  const me = await handleEndpoints({
    config,
    request: new Request(`${payload.config.serverURL}/api/identity/me`, {
      headers: { authorization: `JWT ${login.token}` },
    }),
  })
  assert.equal(me.status, 200, 'O token emitido no login precisa autenticar a identidade do jogo')

  const pending = await payload.create({
    collection: 'users',
    disableVerificationEmail: true,
    data: { name: 'Pendente', username: 'pendente', email: 'pending@example.test', password, role: 'member', _verified: false },
  })
  assert.equal(pending._verified, false)
  await assert.rejects(
    payload.login({ collection: 'users', data: { email: pending.email, password } }),
    'Conta com confirmação pendente não pode entrar',
  )
  const stillPending = await payload.findByID({ collection: 'users', id: pending.id, overrideAccess: true })
  assert.equal(stillPending._verified, false)
  console.log('Conta anterior à confirmação de e-mail entra e mantém a conta pendente bloqueada.')
} catch (error) {
  exitCode = 1
  console.error(error)
} finally {
  await Promise.race([
    payload.destroy(),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ])
  await rm(directory, { recursive: true, force: true })
  process.exit(exitCode)
}
