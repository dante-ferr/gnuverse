import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getPayload, type RequiredDataFromCollectionSlug } from 'payload'
import sharp from 'sharp'

const directory = await mkdtemp(path.join(os.tmpdir(), 'gnuverse-cms-check-'))
process.env.PAYLOAD_SECRET = randomBytes(32).toString('hex')
process.env.DATABASE_ADAPTER = 'sqlite'
process.env.DATABASE_URL = `file:${path.join(directory, 'test.db')}`
process.env.STORAGE_ADAPTER = 'local'
process.env.MEDIA_DIR = path.join(directory, 'media')
process.env.SITE_DEPLOY_HOOK_URL = ''
const { default: configPromise } = await import('../src/payload.config')
const config = await configPromise
assert.ok(Array.isArray(config.cors) && config.cors.includes('http://localhost:3000'), 'CORS precisa permitir origem local em dev')
assert.ok(Array.isArray(config.csrf) && config.csrf.includes('http://localhost:3000'), 'CSRF precisa permitir origem local em dev')

const payload = await getPayload({ config })

function ownerIdOf(owner: unknown): number | string | undefined {
  if (typeof owner === 'object' && owner !== null && 'id' in owner) {
    return (owner as { id?: number | string }).id
  }
  return typeof owner === 'number' || typeof owner === 'string' ? owner : undefined
}

try {
  // 1. Primeiro usuário vira admin mesmo se outro papel for enviado no bootstrap.
  const admin = await payload.create({
    collection: 'users',
    data: {
      name: 'Admin de teste',
      email: 'admin@example.test',
      password: randomBytes(24).toString('hex'),
      role: 'editor',
    },
  })
  assert.equal(admin.role, 'admin', 'Primeiro usuário precisa ser administrador')

  const reviewer = await payload.create({
    collection: 'users',
    user: admin,
    overrideAccess: false,
    data: {
      name: 'Revisor de teste',
      email: 'reviewer@example.test',
      password: randomBytes(24).toString('hex'),
      role: 'reviewer',
    },
  })
  assert.equal(reviewer.role, 'reviewer')

  const editor = await payload.create({
    collection: 'users',
    user: admin,
    overrideAccess: false,
    data: {
      name: 'Editor legado de teste',
      email: 'editor@example.test',
      password: randomBytes(24).toString('hex'),
      role: 'editor',
    },
  })
  assert.equal(editor.role, 'editor')

  // 2. Visitante não autenticado pode se registrar apenas como author.
  const author1 = await payload.create({
    collection: 'users',
    overrideAccess: false,
    // Simula cadastro sem enviar `role` para validar defaultValue: 'author'.
    data: {
      name: 'Autora Um',
      email: 'author1@example.test',
      password: randomBytes(24).toString('hex'),
    } as RequiredDataFromCollectionSlug<'users'>,
  })
  assert.equal(author1.role, 'author', 'Auto-registro sem papel precisa resultar em author')

  const author2 = await payload.create({
    collection: 'users',
    overrideAccess: false,
    data: {
      name: 'Autor Dois',
      email: 'author2@example.test',
      password: randomBytes(24).toString('hex'),
      role: 'author',
    },
  })
  assert.equal(author2.role, 'author')

  // 3. Bloquear registro não autenticado tentando obter papéis privilegiados.
  for (const privilegedRole of ['editor', 'reviewer', 'admin'] as const) {
    await assert.rejects(
      payload.create({
        collection: 'users',
        overrideAccess: false,
        data: {
          name: `Visitante ${privilegedRole}`,
          email: `visitor-${privilegedRole}@example.test`,
          password: 'test-password-123',
          role: privilegedRole,
        },
      }),
      `Visitante não pode se cadastrar como ${privilegedRole}`,
    )
  }

  // 4. Bloquear escalada de privilégio e criação de usuários por não-admins.
  for (const nonAdmin of [author1, reviewer, editor]) {
    const updatedSelf = await payload.update({
      collection: 'users',
      id: nonAdmin.id,
      user: nonAdmin,
      overrideAccess: false,
      data: { role: 'admin' },
    })
    assert.equal(updatedSelf.role, nonAdmin.role, 'Não-admin não pode alterar o próprio papel para admin')

    await assert.rejects(
      payload.create({
        collection: 'users',
        user: nonAdmin,
        overrideAccess: false,
        data: {
          name: 'Outro usuário',
          email: `unauthorized-${nonAdmin.role}@example.test`,
          password: 'test-password-123',
          role: 'author',
        },
      }),
      `Usuário ${nonAdmin.role} não pode criar contas`,
    )
  }

  // 5. Upload de mídia permitido para autores; exclusão restrita a admins.
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#7c3aed' } }).png().toBuffer()
  const media = await payload.create({
    collection: 'media',
    user: author1,
    overrideAccess: false,
    data: { alt: 'Quadrado violeta de teste', credit: 'Fixture de teste GNUverse' },
    file: { data: image, mimetype: 'image/png', name: `test-${randomBytes(6).toString('hex')}.png`, size: image.length },
  })
  assert.ok(media.url, 'Upload precisa ter URL de leitura')
  await assert.rejects(
    payload.delete({ collection: 'media', id: media.id, user: author1, overrideAccess: false }),
    'Autor não pode apagar mídia',
  )

  // 6. Criação de rascunho por autor e isolamento entre autores distintos.
  const example = JSON.parse(await readFile(path.resolve('../content/demo-article.json'), 'utf8'))
  const article = await payload.create({
    collection: 'articles',
    user: author1,
    overrideAccess: false,
    draft: true,
    data: { ...example, cover: media.id, owner: author2.id, _status: 'draft' },
  })
  assert.equal(ownerIdOf(article.owner), author1.id, 'Owner precisa ser atribuído à conta autora autenticada')
  assert.equal(article._status, 'draft')
  assert.equal(article.reviewStatus, 'draft')

  assert.equal((await payload.find({ collection: 'articles', overrideAccess: false })).totalDocs, 0)
  assert.equal((await payload.find({ collection: 'articles', user: author1, overrideAccess: false })).totalDocs, 1)
  assert.ok(
    (await payload.findVersions({ collection: 'articles', user: author1, overrideAccess: false })).totalDocs >= 1,
    'Autora precisa ver o histórico de versões do próprio artigo',
  )

  // author2 não pode ler, listar versões, editar nem apagar rascunho de author1.
  assert.equal((await payload.find({ collection: 'articles', user: author2, overrideAccess: false })).totalDocs, 0)
  assert.equal((await payload.findVersions({ collection: 'articles', user: author2, overrideAccess: false })).totalDocs, 0)
  await assert.rejects(
    payload.findByID({ collection: 'articles', id: article.id, user: author2, overrideAccess: false }),
  )
  await assert.rejects(
    payload.update({
      collection: 'articles',
      id: article.id,
      user: author2,
      overrideAccess: false,
      draft: true,
      data: { title: 'Edição indevida' },
    }),
  )
  await assert.rejects(
    payload.delete({ collection: 'articles', id: article.id, user: author2, overrideAccess: false }),
  )

  // 7. Bloquear publicação direta ou definição de status de revisão restritos por author.
  await assert.rejects(
    payload.create({
      collection: 'articles',
      user: author1,
      overrideAccess: false,
      data: { ...example, slug: 'tentativa-publicacao-direta', _status: 'published' },
    }),
  )
  await assert.rejects(
    payload.update({
      collection: 'articles',
      id: article.id,
      user: author1,
      overrideAccess: false,
      data: { _status: 'published' },
    }),
  )
  for (const restrictedStatus of ['approved', 'changes_requested'] as const) {
    await assert.rejects(
      payload.create({
        collection: 'articles',
        user: author1,
        overrideAccess: false,
        draft: true,
        data: { ...example, slug: `tentativa-${restrictedStatus}`, reviewStatus: restrictedStatus },
      }),
    )
    await assert.rejects(
      payload.update({
        collection: 'articles',
        id: article.id,
        user: author1,
        overrideAccess: false,
        draft: true,
        data: { reviewStatus: restrictedStatus },
      }),
    )
  }

  // 8. Autor envia rascunho para revisão.
  const submitted = await payload.update({
    collection: 'articles',
    id: article.id,
    user: author1,
    overrideAccess: false,
    draft: true,
    data: { reviewStatus: 'in_review' },
  })
  assert.equal(submitted.reviewStatus, 'in_review')
  assert.equal(submitted._status, 'draft')
  assert.equal((await payload.find({ collection: 'articles', overrideAccess: false })).totalDocs, 0)

  // 9. Revisor solicita ajustes com reviewNotes (visível para dona e revisor, oculto de anônimos).
  const feedbackText = 'Detalhe melhor as fontes livres no segundo parágrafo.'
  const withChanges = await payload.update({
    collection: 'articles',
    id: article.id,
    user: reviewer,
    overrideAccess: false,
    draft: true,
    data: { reviewStatus: 'changes_requested', reviewNotes: feedbackText },
  })
  assert.equal(withChanges.reviewStatus, 'changes_requested')
  assert.equal(withChanges.reviewNotes, feedbackText)

  const ownerDraftView = await payload.findByID({
    collection: 'articles',
    id: article.id,
    user: author1,
    overrideAccess: false,
    draft: true,
  })
  assert.equal(ownerDraftView.reviewNotes, feedbackText, 'Autora dona precisa ler reviewNotes')

  // Autora corrige e reenvia para revisão.
  const resubmitted = await payload.update({
    collection: 'articles',
    id: article.id,
    user: author1,
    overrideAccess: false,
    draft: true,
    data: { summary: `${example.summary} Revisado.`, reviewStatus: 'in_review' },
  })
  assert.equal(resubmitted.reviewStatus, 'in_review')
  assert.equal(editor.role, 'editor')

  // 10. Revisor aprova e publica: reviewStatus vira approved, artigo fica público e reviewNotes não vaza.
  const published = await payload.update({
    collection: 'articles',
    id: article.id,
    user: reviewer,
    overrideAccess: false,
    data: { title: example.title, summary: example.summary, _status: 'published' },
  })
  assert.equal(published._status, 'published')
  assert.equal(published.reviewStatus, 'approved')

  const anonFind = await payload.find({ collection: 'articles', overrideAccess: false })
  assert.equal(anonFind.totalDocs, 1)
  assert.equal(anonFind.docs[0].reviewNotes, undefined, 'reviewNotes não pode vazar na listagem pública')

  const anonByID = await payload.findByID({ collection: 'articles', id: article.id, overrideAccess: false })
  assert.equal(anonByID.title, example.title)
  assert.equal(anonByID.reviewNotes, undefined, 'reviewNotes não pode vazar na leitura pública por ID')
  assert.equal(anonByID.owner, undefined, 'owner não pode vazar na leitura pública')

  const otherAuthorPublishedView = await payload.findByID({
    collection: 'articles',
    id: article.id,
    user: author2,
    overrideAccess: false,
  })
  assert.equal(otherAuthorPublishedView.reviewNotes, undefined, 'Outro autor não pode ler reviewNotes de artigo alheio')
  assert.equal(otherAuthorPublishedView.owner, undefined, 'Outro autor não pode ler owner de artigo alheio')

  const ownerPublishedView = await payload.findByID({
    collection: 'articles',
    id: article.id,
    user: author1,
    overrideAccess: false,
  })
  assert.equal(ownerPublishedView.reviewNotes, feedbackText, 'Dona continua lendo reviewNotes após publicação')
  assert.equal(ownerIdOf(ownerPublishedView.owner), author1.id, 'Dona continua lendo o próprio owner')

  const authorOwnedFind = await payload.find({
    collection: 'articles',
    user: author1,
    overrideAccess: false,
    draft: true,
    where: { owner: { equals: author1.id } },
  })
  assert.equal(authorOwnedFind.totalDocs, 1, 'Autora precisa conseguir filtrar os próprios artigos por owner')

  await assert.rejects(
    payload.find({
      collection: 'articles',
      overrideAccess: false,
      where: { owner: { equals: author1.id } },
    }),
    'Visitante anônimo não pode enumerar artigos por where[owner]',
  )

  const xssBody = {
    root: {
      ...example.body.root,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 1,
              fields: { url: 'javascript:alert(1)', linkType: 'custom' },
              children: [{ type: 'text', version: 1, text: 'clique' }],
            },
          ],
        },
      ],
    },
  }
  await assert.rejects(
    payload.create({
      collection: 'articles',
      user: author1,
      overrideAccess: false,
      draft: true,
      data: { ...example, slug: 'artigo-link-xss', body: xssBody, _status: 'draft' },
    }),
    'CMS precisa rejeitar links javascript: no corpo Lexical',
  )

  // 11. Bloquear sobrescrita direta (não-rascunho) e exclusão de publicado por autor,
  //     permitindo nova versão draft: true sem alterar o artigo publicado.
  await assert.rejects(
    payload.update({
      collection: 'articles',
      id: article.id,
      user: author1,
      overrideAccess: false,
      draft: false,
      data: { title: 'Sobrescrita direta proibida' },
    }),
  )
  await assert.rejects(
    payload.update({
      collection: 'articles',
      id: article.id,
      user: author1,
      overrideAccess: false,
      data: { title: 'Sobrescrita implícita proibida' },
    }),
  )
  await assert.rejects(
    payload.delete({ collection: 'articles', id: article.id, user: author1, overrideAccess: false }),
    'Autora não pode apagar artigo já publicado',
  )

  const draftRevision = await payload.update({
    collection: 'articles',
    id: article.id,
    user: author1,
    overrideAccess: false,
    draft: true,
    data: { title: 'Alteração ainda não publicada', _status: 'draft' },
  })
  assert.equal(draftRevision._status, 'draft')
  assert.equal(draftRevision.reviewStatus, 'draft', 'Nova revisão em rascunho não pode manter status approved')

  const publicArticle = (await payload.find({ collection: 'articles', overrideAccess: false })).docs[0]
  assert.equal(publicArticle.title, example.title, 'Novo rascunho não pode vazar para leitura pública')

  await assert.rejects(
    payload.delete({ collection: 'articles', id: article.id, user: author1, overrideAccess: false }),
    'Autora continua impedida de apagar artigo publicado mesmo após salvar rascunho de revisão',
  )

  // Autora pode apagar rascunho próprio nunca publicado.
  const disposableDraft = await payload.create({
    collection: 'articles',
    user: author1,
    overrideAccess: false,
    draft: true,
    data: { ...example, slug: 'rascunho-descartavel', _status: 'draft' },
  })
  await payload.delete({ collection: 'articles', id: disposableDraft.id, user: author1, overrideAccess: false })

  await payload.delete({ collection: 'articles', id: article.id, user: reviewer, overrideAccess: false })
  assert.equal((await payload.find({ collection: 'articles', overrideAccess: false })).totalDocs, 0)
  await payload.delete({ collection: 'media', id: media.id, user: admin, overrideAccess: false })

  console.log(
    'CMS verificado: bootstrap admin, auto-registro author, bloqueio de escalada, isolamento entre autores, fluxo editorial de revisão/aprovação, proteção contra sobrescrita de publicado e sigilo de reviewNotes.',
  )
} finally {
  await payload.destroy()
  await rm(directory, { recursive: true, force: true })
}
