import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getPayload } from 'payload'
import sharp from 'sharp'

const directory = await mkdtemp(path.join(os.tmpdir(), 'gnuverse-cms-check-'))
process.env.PAYLOAD_SECRET = randomBytes(32).toString('hex')
process.env.DATABASE_ADAPTER = 'sqlite'
process.env.DATABASE_URL = `file:${path.join(directory, 'test.db')}`
process.env.STORAGE_ADAPTER = 'local'
process.env.SITE_DEPLOY_HOOK_URL = ''
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

try {
  const admin = await payload.create({ collection: 'users', data: {
    name: 'Admin de teste', email: 'admin@example.test', password: randomBytes(24).toString('hex'), role: 'editor',
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
  console.log('CMS verificado: bootstrap admin, editor, bloqueio de escalada, upload de capa, rascunho privado, publicação e exclusão.')
} finally {
  await payload.destroy()
  await rm(directory, { recursive: true, force: true })
}
