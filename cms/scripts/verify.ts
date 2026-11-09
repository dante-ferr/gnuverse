import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createLocalReq, getPayload, handleEndpoints } from 'payload'
import sharp from 'sharp'
import { verifySharedIdentity } from './verify-identity'

const directory = await mkdtemp(path.join(os.tmpdir(), 'gnuverse-cms-check-'))
// Prevent the verification process from attaching to a running Next.js HMR server.
Object.assign(process.env, { NODE_ENV: 'test' })
process.env.PAYLOAD_SECRET = randomBytes(32).toString('hex')
process.env.DATABASE_ADAPTER = 'sqlite'
process.env.DATABASE_URL = `file:${path.join(directory, 'test.db')}`
process.env.STORAGE_ADAPTER = 'local'
process.env.SITE_DEPLOY_HOOK_URL = ''
process.env.GNUVERSE_DATA_DIR = directory
delete process.env.GNUVERSE_AUTHZ_FILE
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

try {
  const adminPassword = 'abc' // Fixture: existing Payload passwords must not be rejected by a second policy.
  const admin = await payload.create({ collection: 'users', data: {
    name: 'Admin de teste', email: 'admin@example.test', password: adminPassword, role: 'editor',
  } })
  assert.equal(admin.role, 'admin', 'Primeiro usuário precisa ser administrador')
  const editor = await payload.create({ collection: 'users', user: admin, overrideAccess: false, data: {
    name: 'Editor de teste', email: 'editor@example.test', password: randomBytes(24).toString('hex'), role: 'editor',
  } })
  await assert.rejects(payload.create({ collection: 'users', overrideAccess: false, data: {
    name: 'Visitante', email: 'visitor@example.test', password: 'test-password-123', role: 'editor',
  } }))
  const attemptedUpgrade = await payload.update({ collection: 'users', id: editor.id, user: editor, overrideAccess: false, data: { role: 'admin' } })
  assert.equal(attemptedUpgrade.role, 'editor', 'Editor não pode aumentar suas permissões')
  await assert.rejects(payload.create({ collection: 'users', user: editor, overrideAccess: false, data: {
    name: 'Outro usuário', email: 'other@example.test', password: 'test-password-123', role: 'editor',
  } }))
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#7c3aed' } }).png().toBuffer()
  const media = await payload.create({ collection: 'media', user: editor, overrideAccess: false,
    data: { alt: 'Quadrado violeta de teste', credit: 'Fixture de teste GNUverse' },
    file: { data: image, mimetype: 'image/png', name: `test-${randomBytes(6).toString('hex')}.png`, size: image.length },
  })
  assert.ok(media.url, 'Upload precisa ter URL de leitura')
  const example = JSON.parse(await readFile(path.resolve('../content/demo-article.json'), 'utf8'))
  const article = await payload.create({ collection: 'articles', user: editor, overrideAccess: false, data: { ...example, cover: media.id, _status: 'draft' } })
  assert.equal((await payload.find({ collection: 'articles', overrideAccess: false })).totalDocs, 0)
  await payload.update({ collection: 'articles', id: article.id, user: editor, overrideAccess: false, data: { _status: 'published' } })
  assert.equal((await payload.find({ collection: 'articles', overrideAccess: false })).totalDocs, 1)
  await payload.update({ collection: 'articles', id: article.id, user: editor, overrideAccess: false, draft: true, data: { title: 'Alteração ainda não publicada', _status: 'draft' } })
  const publicArticle = (await payload.find({ collection: 'articles', overrideAccess: false })).docs[0]
  assert.equal(publicArticle.title, example.title, 'Novo rascunho não pode vazar para leitura pública')
  await payload.delete({ collection: 'articles', id: article.id, user: editor, overrideAccess: false })
  assert.equal((await payload.find({ collection: 'articles', overrideAccess: false })).totalDocs, 0)
  await payload.delete({ collection: 'media', id: media.id, user: admin, overrideAccess: false })
  const { accessManagementEndpoints } = await import('../src/access-management/endpoints')
  async function access(user: typeof admin | undefined, body?: object) {
    const handler = accessManagementEndpoints.find((endpoint) => endpoint.path === '/access-management' && endpoint.method === (body ? 'post' : 'get'))!.handler
    const req = await createLocalReq({ user: user ? { ...user, collection: 'users' } : undefined, req: {
      url: `${payload.config.serverURL}/api/access-management`,
      headers: new Headers({ 'Content-Type': 'application/json', origin: String(payload.config.serverURL) }),
      text: async () => JSON.stringify(body),
    } }, payload)
    const response = await handler(req)
    return { status: response.status, data: await response.json() }
  }
  assert.equal((await access(undefined)).status, 401)
  assert.equal((await access(editor)).status, 403)
  assert.equal((await access(admin)).data.enabled, false)
  const activated = await access(admin, { action: 'initialize', revision: '' })
  assert.equal(activated.status, 200)
  assert.equal(activated.data.entries.length, 2)
  const login = await payload.login({ collection: 'users', data: { email: admin.email, password: adminPassword } })
  const routed = await handleEndpoints({ config, request: new Request(`${payload.config.serverURL}/api/access-management`, {
    headers: { authorization: `JWT ${login.token}` },
  }) })
  assert.equal(routed.status, 200, 'Rota deve aceitar uma sessão real do Payload')
  assert.equal((await routed.json()).enabled, true)
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async (_input, init) => {
      const headers = new Headers(init?.headers)
      assert.equal(headers.get('authorization'), `JWT ${login.token}`, 'Consulta do jogo deve encaminhar a sessão como JWT, sem depender de cookies entre origens')
      assert.equal(headers.get('cookie'), null)
      return Response.json({ accounts: [{ provider: 'game', id: 'game-account', name: 'Jogador', email: 'player@example.test' }] })
    }
    const accountsHandler = accessManagementEndpoints.find((endpoint) => endpoint.path === '/access-management/accounts')!.handler
    const accountsReq = await createLocalReq({ user: { ...admin, collection: 'users' }, req: {
      headers: new Headers({ cookie: `${payload.config.cookiePrefix}-token=${login.token}` }),
    } }, payload)
    const accounts = await (await accountsHandler(accountsReq)).json()
    assert.equal(accounts.gameError, undefined)
    assert.equal(accounts.accounts.filter((account: { provider: string }) => account.provider === 'game').length, 1)
  } finally { globalThis.fetch = originalFetch }
  const adminEntry = activated.data.entries.find((entry: { roles: string[] }) => entry.roles.includes('admin'))
  const editorEntry = activated.data.entries.find((entry: { roles: string[] }) => entry.roles.includes('blog-editor'))
  assert.equal((await access(admin, { action: 'delete', id: adminEntry.id, revision: activated.data.revision })).status, 409, 'Último administrador não pode ser removido')
  await assert.rejects(payload.delete({ collection: 'users', id: admin.id, user: admin, overrideAccess: false }), /administrador com acesso ao painel/)
  assert.equal((await access(editor, { action: 'save', entry: { ...editorEntry, roles: ['admin'] }, revision: activated.data.revision })).status, 403)
  const changed = await access(admin, { action: 'save', entry: { ...editorEntry, roles: ['quiz-editor'] }, revision: activated.data.revision })
  assert.equal(changed.status, 200)
  assert.deepEqual(changed.data.entries.find((entry: { id: string }) => entry.id === editorEntry.id).roles, ['quiz-editor'])
  const routedSave = await handleEndpoints({ config, request: new Request(`${payload.config.serverURL}/api/access-management`, {
    method: 'POST', headers: { authorization: `JWT ${login.token}`, 'Content-Type': 'application/json', origin: String(payload.config.serverURL) },
    body: JSON.stringify({ action: 'save', entry: { ...editorEntry, roles: ['invented-role'] }, revision: changed.data.revision }),
  }) })
  assert.equal(routedSave.status, 400, 'Rota deve validar o corpo JSON da requisição real')
  assert.equal((await access(admin, { action: 'save', entry: editorEntry, revision: activated.data.revision })).status, 409, 'Edição antiga deve falhar sem perder alterações')
  assert.equal((await access(admin, { action: 'save', entry: { ...editorEntry, roles: ['invented-role'] }, revision: changed.data.revision })).status, 400)
  assert.equal((await access(admin, { action: 'save', entry: { name: 'Duplicada', roles: ['member'], identities: adminEntry.identities }, revision: changed.data.revision })).status, 400)
  const removed = await access(admin, { action: 'delete', id: editorEntry.id, revision: changed.data.revision })
  assert.equal(removed.status, 200)
  assert.ok(await payload.findByID({ collection: 'users', id: editor.id }), 'Remover vínculo não exclui a conta')
  await verifySharedIdentity(payload, directory, admin.email, adminPassword)
  console.log('CMS verificado: bootstrap admin, editor, bloqueio de escalada, upload de capa, rascunho privado, publicação e exclusão.')
  console.log('Interface de acessos verificada: ativação, preservação de papéis, autorização, edição, revogação, último administrador e conflitos de edição.')
  console.log('Identidade única verificada: admin entra no site, cadastro compartilhado, bloqueio de escalada e revogação de sessão pelo provedor.')
} finally {
  await payload.destroy()
  await rm(directory, { recursive: true, force: true })
}
