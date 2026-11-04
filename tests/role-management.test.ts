import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readRoleRegistry, updateRoleRegistry } from '../core/authz/manage-role-store.ts'
import { createGameServer } from '../game-server/server.ts'

test('registry publishes atomic revisions, rejects duplicate identities and prevents lost updates', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gnuverse-roles-ui-'))
  const path = join(directory, 'roles.json')
  try {
    const initial = readRoleRegistry(path)
    assert.equal(initial.enabled, false)
    const updated = updateRoleRegistry('', () => [{ id: 'one', name: 'Pessoa', roles: ['member'], identities: [{ provider: 'example', id: 'local-id' }] }], path)
    assert.equal(updated.enabled, true)
    assert.ok(updated.revision)
    assert.throws(() => updateRoleRegistry('', () => [], path), /outra sessão/)
    assert.throws(() => updateRoleRegistry(updated.revision, (entries) => [...entries, { ...entries[0], id: 'two' }], path), /vínculos inválidos/)
    assert.equal(readRoleRegistry(path).revision, updated.revision)
    assert.throws(() => updateRoleRegistry(updated.revision, () => { throw new Error('Aborted') }, path))
    assert.equal(readRoleRegistry(path).revision, updated.revision)
    writeFileSync(`${path}.lock`, '')
    assert.throws(() => updateRoleRegistry(updated.revision, () => [], path), /Outra alteração/)
    assert.equal(JSON.parse(readFileSync(path, 'utf8'))[0].name, 'Pessoa')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('game account directory verifies CMS admin sessions and never exposes credentials', async () => {
  const previous = process.env.CMS_URL
  const cms = createServer((req, res) => {
    assert.equal(req.url, '/api/access-management/verify')
    const allowed = req.headers.cookie === 'payload-token=admin-session'
    res.writeHead(allowed ? 200 : 403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ allowed }))
  })
  const game = createGameServer({ dbPath: ':memory:' })
  try {
    await new Promise<void>((resolve) => cms.listen(0, '127.0.0.1', resolve))
    process.env.CMS_URL = `http://127.0.0.1:${(cms.address() as AddressInfo).port}`
    const base = await game.listen()
    const registered = await fetch(`${base}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: 'directory-user', email: 'directory@example.test', password: 'test-password' }) })
    const user = await registered.json()
    assert.equal((await fetch(`${base}/api/admin/accounts`)).status, 401)
    assert.equal((await fetch(`${base}/api/admin/accounts`, { headers: { Authorization: `Bearer ${user.token}` } })).status, 403)
    assert.equal((await fetch(`${base}/api/admin/accounts`, { headers: { cookie: 'payload-token=editor-session' } })).status, 403)
    const response = await fetch(`${base}/api/admin/accounts`, { headers: { cookie: 'payload-token=admin-session' } })
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).accounts, [{ id: user.user.id, name: 'directory-user', email: 'directory@example.test', provider: 'game' }])
  } finally {
    if (previous === undefined) delete process.env.CMS_URL
    else process.env.CMS_URL = previous
    await game.close()
    await new Promise<void>((resolve) => cms.close(() => resolve()))
  }
})
