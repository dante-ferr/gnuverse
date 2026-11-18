import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { can, canManageRoom, PERMISSIONS } from '../core/authz/policy.ts'
import { resolveActor } from '../core/authz/identity.ts'
import { FileRoleStore } from '../core/authz/file-role-store.ts'
import { cmsActor } from '../cms/src/access.ts'

test('policies isolate domains, check ownership and reject unknown grants', () => {
  const actor = (roles: string[]) => ({ id: 'owner', roles: roles as ['member'] })
  assert.equal(can(null, 'quiz:manage'), false)
  for (const permission of PERMISSIONS) {
    assert.equal(can(actor(['admin']), permission, { ownerId: 'owner' }), true)
  }
  assert.equal(can(actor(['blog-editor']), 'article:manage'), true)
  assert.equal(can(actor(['blog-editor']), 'room:delete:any'), false)
  assert.equal(can(actor(['quiz-editor']), 'quiz:manage'), true)
  assert.equal(can(actor(['quiz-editor']), 'cms:access'), false)
  assert.equal(can(actor(['game-moderator']), 'article:manage'), false)
  assert.equal(can(actor(['game-moderator']), 'cms:access'), true)
  assert.equal(can(actor(['game-moderator']), 'room:chat:moderate'), true)
  assert.equal(can(actor(['blog-editor']), 'room:chat:moderate'), false)
  assert.equal(canManageRoom(actor(['game-moderator']), 'delete', 'someone-else'), true)
  assert.equal(canManageRoom(actor(['member']), 'update', 'owner'), true)
  assert.equal(canManageRoom(actor(['member']), 'update', 'someone-else'), false)
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
    assert.equal(can(resolveActor({ provider: 'game', id: 'game-id' }, store), 'room:delete:any'), true)
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