import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { handleEndpoints, type Payload } from 'payload'
import { createGameServer } from '../../game-server/server.ts'
import { CMSIdentityProvider } from '../../game-server/auth/cms-identity-provider.ts'

/** Real Payload authentication behind HTTP, isolated from all development databases. */
export async function verifySharedIdentity(payload: Payload, directory: string, adminEmail: string, adminPassword: string) {
  let unavailable = false
  const issuer = createServer((req, res) => {
    void (async () => {
      if (unavailable) { res.writeHead(503); res.end('{}'); return }
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(Buffer.from(chunk))
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
      const response = await handleEndpoints({ config: payload.config, request: new Request(`http://127.0.0.1${req.url}`, {
        method: req.method, headers,
        ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
      }) })
      res.writeHead(response.status, Object.fromEntries(response.headers))
      res.end(Buffer.from(await response.arrayBuffer()))
    })().catch(() => { res.writeHead(500); res.end() })
  })
  await new Promise<void>((resolve) => issuer.listen(0, '127.0.0.1', resolve))
  const issuerURL = `http://127.0.0.1:${(issuer.address() as AddressInfo).port}`
  const dbPath = join(directory, 'identity-game.sqlite')
  const game = createGameServer({ dbPath, identityProvider: new CMSIdentityProvider(issuerURL) })
  try {
    const base = await game.listen()
    async function request(path: string, body?: object, token?: string) {
      const response = await fetch(`${base}/api${path}`, {
        method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      return { status: response.status, data: await response.json() }
    }
    const before = (await payload.count({ collection: 'users' })).totalDocs
    const login = await request('/login', { email: adminEmail, password: adminPassword })
    assert.equal(login.status, 200, 'Conta do primeiro admin do Payload deve entrar diretamente no site')
    assert.ok(login.data.user.roles.includes('admin'), 'Administrador deve herdar papéis sem vincular outro cadastro')
    assert.equal((await payload.count({ collection: 'users' })).totalDocs, before, 'Login não duplica a conta canônica')
    assert.equal((await request('/me', undefined, login.data.token)).status, 200)
    unavailable = true
    assert.equal((await request('/me', undefined, login.data.token)).status, 503, 'Falha do provedor não pode ativar autenticação local alternativa')
    unavailable = false
    assert.equal((await request('/login', { email: adminEmail, password: 'incorrect-password' })).status, 401)
    const registered = await request('/register', { nickname: 'participante', email: 'site-member@example.test', password: 'site-password', roles: ['admin'], role: 'admin' })
    assert.equal(registered.status, 201)
    assert.deepEqual(registered.data.user.roles, ['member'])
    const member = (await payload.find({ collection: 'users', where: { email: { equals: 'site-member@example.test' } } })).docs[0]
    assert.equal(member.role, 'member', 'Cadastro público não pode conceder acesso editorial')
    const nativeLogin = await payload.login({ collection: 'users', data: { email: member.email, password: 'site-password' } })
    assert.ok(nativeLogin.token, 'A conta criada pelo site deve autenticar no mesmo provedor do painel')
    assert.equal((await request('/register', { nickname: 'duplicate', email: member.email, password: 'site-password' })).status, 409)
    const revoked = await fetch(`${issuerURL}/api/users/logout`, { method: 'POST', headers: { authorization: `JWT ${login.data.token}`, 'Content-Type': 'application/json' }, body: '{}' })
    assert.equal(revoked.status, 200)
    assert.equal((await request('/me', undefined, login.data.token)).status, 401, 'Revogar a sessão no provedor precisa revogar o acesso ao jogo')
    await game.close()
    const db = new DatabaseSync(dbPath)
    const state = JSON.parse(db.prepare('SELECT value FROM game_state WHERE id=1').get()!.value as string)
    db.close()
    for (const profile of Object.values(state.users) as Record<string, unknown>[]) {
      assert.equal(profile.password, undefined)
      assert.equal(profile.salt, undefined)
      assert.equal((profile.identity as { provider: string }).provider, 'cms')
    }
    assert.equal(readFileSync(dbPath).includes(Buffer.from(login.data.token)), false, 'O jogo não deve persistir credenciais do provedor')
  } finally {
    await game.close()
    await new Promise<void>((resolve) => issuer.close(() => resolve()))
  }
}
