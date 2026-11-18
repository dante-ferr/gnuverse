import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getPayload, handleEndpoints } from 'payload'
import { createGameServer } from '../../game-server/server.ts'
import { CMSIdentityProvider } from '../../game-server/auth/cms-identity-provider.ts'
import {
  EMAIL_CONFIRM_LINK_MESSAGE,
  EMAIL_CONFIRMED_MESSAGE,
} from '../src/identity/verify-email.ts'

const directory = await mkdtemp(path.join(os.tmpdir(), 'gnuverse-email-flow-'))
Object.assign(process.env, {
  NODE_ENV: 'development',
  PAYLOAD_SECRET: randomBytes(32).toString('hex'),
  DATABASE_ADAPTER: 'sqlite',
  DATABASE_URL: `file:${path.join(directory, 'test.db')}`,
  STORAGE_ADAPTER: 'local',
  CMS_PORT: '3998',
  CMS_SEEDING: '1',
  EMAIL_VERIFICATION: 'true',
  GNUVERSE_DATA_DIR: directory,
  GNUVERSE_SITE_URL: 'http://localhost:3000',
  HOST_ADMIN_EMAIL: 'host@example.test',
  HOST_ADMIN_PASSWORD: 'host-admin-password',
  HOST_ADMIN_NAME: 'Host Admin',
  HOST_ADMIN_USERNAME: 'host_admin',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  SMTP_FROM_ADDRESS: 'gnuverse@localhost',
})
delete process.env.GNUVERSE_AUTHZ_FILE

const { default: config } = await import('../src/payload.config.ts')
const payload = await getPayload({ config })
let exitCode = 0

const issuer = createServer((req, res) => {
  void (async () => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    }
    const response = await handleEndpoints({
      config: payload.config,
      request: new Request(`http://127.0.0.1${req.url}`, {
        method: req.method,
        headers,
        ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
      }),
    })
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(Buffer.from(await response.arrayBuffer()))
  })().catch(() => {
    res.writeHead(500)
    res.end()
  })
})

await new Promise<void>((resolve) => issuer.listen(0, '127.0.0.1', resolve))
const issuerURL = `http://127.0.0.1:${(issuer.address() as AddressInfo).port}`
const game = createGameServer({
  dbPath: path.join(directory, 'game.sqlite'),
  identityProvider: new CMSIdentityProvider(issuerURL),
})

try {
  const base = await game.listen()
  async function request(pathName: string, body?: object) {
    const response = await fetch(`${base}/api${pathName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    return { status: response.status, data: await response.json() }
  }

  const password = 'member-password'
  const created = await payload.create({
    collection: 'users',
    overrideAccess: true,
    disableVerificationEmail: true,
    data: {
      name: 'Membro',
      username: 'membro_email',
      email: 'membro@example.test',
      password,
      role: 'member',
      _verified: false,
    },
  })
  const token = randomBytes(20).toString('hex')
  await payload.db.updateOne({
    id: created.id,
    collection: 'users',
    data: { _verificationToken: token, _verified: false },
    returning: false,
  })

  await assert.rejects(
    payload.login({ collection: 'users', data: { email: 'membro@example.test', password } }),
    'Conta não confirmada não pode entrar',
  )

  const first = await request(`/verify-email/${encodeURIComponent(token)}`)
  assert.equal(first.status, 200)
  assert.equal(first.data.message, EMAIL_CONFIRMED_MESSAGE)

  const confirmed = await payload.findByID({
    collection: 'users',
    id: created.id,
    overrideAccess: true,
    showHiddenFields: true,
  })
  assert.equal(confirmed._verified, true)
  assert.equal(confirmed._verificationToken, null)

  const replay = await request(`/verify-email/${encodeURIComponent(token)}`)
  assert.equal(replay.status, 200)
  assert.equal(replay.data.message, EMAIL_CONFIRM_LINK_MESSAGE)

  const login = await request('/login', { email: 'membro@example.test', password })
  assert.equal(login.status, 200)
  assert.equal(typeof login.data.token, 'string')

  const usernameLogin = await request('/login', { email: 'membro_email', password })
  assert.equal(usernameLogin.status, 200)

  const unknown = await request(`/verify-email/${encodeURIComponent(randomBytes(20).toString('hex'))}`)
  assert.equal(unknown.status, 200)
  assert.equal(unknown.data.message, EMAIL_CONFIRM_LINK_MESSAGE)

  console.log('Fluxo de confirmação de e-mail: bloqueio, confirmação, replay e login OK.')
} catch (error) {
  exitCode = 1
  console.error(error)
} finally {
  await game.close()
  await new Promise<void>((resolve) => issuer.close(() => resolve()))
  await Promise.race([
    payload.destroy(),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ])
  await rm(directory, { recursive: true, force: true })
  process.exit(exitCode)
}
