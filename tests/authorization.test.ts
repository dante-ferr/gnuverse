import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { can, canManageTower, PERMISSIONS } from '../core/authz/policy.ts'
import { resolveActor } from '../core/authz/identity.ts'
import { FileRoleStore } from '../core/authz/file-role-store.ts'
import { cmsActor } from '../cms/src/access.ts'
import { createGameServer } from '../game-server/server.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

test('policies isolate domains, check ownership and reject unknown grants', () => {
  const actor = (roles: string[]) => ({ id: 'owner', roles: roles as ['member'] })
  assert.equal(can(null, 'quiz:manage'), false)
  for (const permission of PERMISSIONS) {
    assert.equal(can(actor(['admin']), permission, { ownerId: 'owner' }), true)
  }
  assert.equal(can(actor(['blog-editor']), 'article:manage'), true)
  assert.equal(can(actor(['blog-editor']), 'tower:delete:any'), false)
  assert.equal(can(actor(['quiz-editor']), 'quiz:manage'), true)
  assert.equal(can(actor(['quiz-editor']), 'cms:access'), false)
  assert.equal(can(actor(['game-moderator']), 'article:manage'), false)
  assert.equal(canManageTower(actor(['game-moderator']), 'delete', 'someone-else'), true)
  assert.equal(canManageTower(actor(['member']), 'update', 'owner'), true)
  assert.equal(canManageTower(actor(['member']), 'update', 'someone-else'), false)
  assert.equal(can(actor(['toString']), 'roles:manage'), false)
  assert.equal(can(actor(['admin']), 'unknown' as 'roles:manage'), false)
})

test('central assignments link CMS and game identities and override legacy CMS roles', () => {
  const folder = mkdtempSync(join(tmpdir(), 'gnuverse-authz-'))
  const path = join(folder, 'roles.json')
  const previous = process.env.GNUVERSE_AUTHZ_FILE
  try {
    writeFileSync(path, JSON.stringify([{ id: 'person', roles: ['admin'], identities: [
      { provider: 'cms', id: '1' }, { provider: 'game', id: 'game-id' },
    ] }]))
    process.env.GNUVERSE_AUTHZ_FILE = path
    const store = new FileRoleStore(path)
    assert.equal(store.find({ provider: 'cms', id: '1' })?.id, store.find({ provider: 'game', id: 'game-id' })?.id)
    assert.equal(can(cmsActor({ id: 1, role: 'editor' }), 'roles:manage'), true)
    assert.equal(can(cmsActor({ id: 2, role: 'admin' }), 'roles:manage'), false)
    assert.equal(can(resolveActor({ provider: 'game', id: 'game-id' }, store), 'tower:delete:any'), true)
    writeFileSync(path, '[]')
    assert.equal(can(cmsActor({ id: 1, role: 'admin' }), 'roles:manage'), false)
    writeFileSync(path, '[{"id":"bad","roles":["superadmin"],"identities":[]}]')
    assert.throws(() => cmsActor({ id: 1, role: 'admin' }), /Invalid authorization/)
    writeFileSync(path, JSON.stringify([{ id: 'duplicate', roles: [], identities: [
      { provider: 'game', id: 'same' }, { provider: 'game', id: 'same' },
    ] }]))
    assert.throws(() => store.find({ provider: 'game', id: 'same' }), /Duplicate/)
  } finally {
    if (previous === undefined) delete process.env.GNUVERSE_AUTHZ_FILE
    else process.env.GNUVERSE_AUTHZ_FILE = previous
    rmSync(folder, { recursive: true, force: true })
  }
})

test('game enforces administrative mutation and live revocation with the same session', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'gnuverse-admin-'))
  const path = join(folder, 'roles.json')
  writeFileSync(path, '[]')
  const identityProvider = createTestIdentityProvider({ roles: (id) => new FileRoleStore(path).find({ provider: 'game', id })?.roles ?? ['member'] })
  const game = createGameServer({ dbPath: ':memory:', identityProvider })
  const base = await game.listen()
  async function request(path: string, token?: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: response.status, data: await response.json() }
  }
  try {
    const owner = (await request('/register', undefined, { nickname: 'owner', email: 'owner@example.test', password: 'test-password' })).data
    const other = (await request('/register', undefined, { nickname: 'other', email: 'other@example.test', password: 'test-password', roles: ['admin'] })).data
    assert.deepEqual(other.user.roles, ['member'])
    const tower = (await request('/towers', owner.token, { name: 'Original tower' })).data.tower
    const endpoint = `/towers/${tower.id}`
    assert.equal((await request(endpoint, undefined, undefined, 'DELETE')).status, 401)
    assert.equal((await request(endpoint, other.token, undefined, 'DELETE')).status, 403)
    assert.equal((await request(`${endpoint}/settings`, other.token, { cost: 0, reason: 'Denied edit' })).status, 403)
    assert.equal((await request(`${endpoint}/restore`, owner.token, { snapshotId: null, reason: 'Denied reset' })).status, 403)
    writeFileSync(path, JSON.stringify([{ id: 'moderator', roles: ['admin'], identities: [{ provider: 'game', id: other.user.id }] }]))
    assert.deepEqual((await request('/me', other.token)).data.user.roles, ['member', 'admin'])
    const edited = await request(`${endpoint}/settings`, other.token, { name: 'Renamed by admin', allowCreatorBan: true, reason: 'Moderation edit' })
    assert.equal(edited.status, 200)
    assert.equal(edited.data.tower.name, 'Renamed by admin')
    assert.equal(edited.data.tower.allowCreatorBan, true)
    const placed = await request(`${endpoint}/blocks`, owner.token, { x: 500, y: 180 })
    assert.equal(placed.status, 200)
    const reset = await request(`${endpoint}/restore`, other.token, { snapshotId: null, reason: 'Moderation reset' })
    assert.equal(reset.status, 200)
    assert.equal(reset.data.events.at(-2).type, 'admin-restore')
    assert.equal(reset.data.snapshots.length, 3)
    assert.equal(reset.data.frame.blocks.length, 0)
    assert.equal(reset.data.snapshots[1].blocks.length, 1)
    const restored = await request(`${endpoint}/restore`, other.token, { snapshotId: reset.data.snapshots[1].id, reason: 'Restore original' })
    assert.equal(restored.status, 200)
    assert.equal(restored.data.frame.blocks.length, 1)
    writeFileSync(path, '[]')
    assert.equal((await request(`${endpoint}/settings`, other.token, { cost: 1, reason: 'Revoked edit' })).status, 403)
    assert.equal((await request(endpoint, other.token, undefined, 'DELETE')).status, 403)
    writeFileSync(path, JSON.stringify([{ id: 'moderator', roles: ['game-moderator'], identities: [{ provider: 'game', id: other.user.id }] }]))
    assert.equal((await request(endpoint, other.token, undefined, 'DELETE')).status, 200)
    assert.equal((await request(endpoint)).status, 404)
  } finally {
    await game.close()
    rmSync(folder, { recursive: true, force: true })
  }
})
