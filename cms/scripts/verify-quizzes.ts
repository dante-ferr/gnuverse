import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getPayload, handleEndpoints } from 'payload'
import { plainTextToLexical } from '../../src/lib/blog-submission.ts'

const directory = await mkdtemp(path.join(os.tmpdir(), 'gnuverse-quizzes-'))
Object.assign(process.env, {
  NODE_ENV: 'test',
  PAYLOAD_SECRET: randomBytes(32).toString('hex'),
  DATABASE_ADAPTER: 'sqlite',
  DATABASE_URL: `file:${path.join(directory, 'test.db')}`,
  STORAGE_ADAPTER: 'local',
  GNUVERSE_DATA_DIR: directory,
  HOST_ADMIN_EMAIL: 'admin@example.test',
  HOST_ADMIN_PASSWORD: randomBytes(24).toString('hex'),
  HOST_ADMIN_NAME: 'Admin',
  HOST_ADMIN_USERNAME: 'admin',
  SITE_DEPLOY_HOOK_URL: '',
})
delete process.env.GNUVERSE_AUTHZ_FILE
const { default: configPromise } = await import('../src/payload.config')
const config = await configPromise
// An isolated test schema must not overwrite production auth types.
config.typescript.autoGenerate = false
const payload = await getPayload({ config })
try {
  const admin = (await payload.find({ collection: 'users', limit: 1 })).docs[0]
  const users = []
  const passwords: string[] = []
  for (const name of ['author', 'other', 'reviewer', 'quiz_editor']) {
    const password = randomBytes(24).toString('hex')
    passwords.push(password)
    users.push(
      await payload.create({
        collection: 'users',
        user: admin,
        overrideAccess: false,
        data: {
          name,
          username: name,
          email: `${name}@example.test`,
          password,
          role: name === 'reviewer' ? 'reviewer' : 'author',
        },
      }),
    )
  }
  const [author, other, reviewer, quizEditor] = users
  const data = {
    title: 'Quiz livre',
    slug: 'quiz-livre',
    summary: 'Aprenda sobre software livre.',
    questions: [
      {
        prompt: 'Qual é uma liberdade?',
        choices: [{ text: 'Estudar o código' }, { text: 'Proibir cópias' }],
        correctAnswer: 0,
        explanation: 'Estudar e modificar são liberdades.',
      },
    ],
  }
  const login = await payload.login({
    collection: 'users',
    data: { email: author.email, password: passwords[0] },
  })
  async function rest(route: string, method = 'GET', body?: unknown) {
    return handleEndpoints({
      config,
      request: new Request(`${payload.config.serverURL}/api/${route}`, {
        method,
        headers: {
          Authorization: `Bearer ${login.token}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    })
  }
  const created = await rest('quizzes', 'POST', {
    ...data,
    slug: 'quiz-via-rest',
    owner: other.id,
    status: 'in_review',
  })
  assert.equal(created.status, 201)
  const restDoc = (await created.json()).doc
  assert.equal(restDoc.owner.id ?? restDoc.owner, author.id)
  assert.equal(
    (await rest(`quizzes?where[owner][equals]=${author.id}`)).status,
    200,
  )
  assert.equal(
    (
      await rest(`quizzes/${restDoc.id}?draft=true`, 'PATCH', {
        status: 'published',
      })
    ).status,
    403,
  )
  assert.equal(
    (await rest(`quizzes/${restDoc.id}?draft=true`, 'PATCH', { questions: [] }))
      .status,
    400,
  )
  assert.equal((await rest(`quizzes/${restDoc.id}`, 'DELETE')).status, 200)
  const create = (user = author, extra = {}) =>
    payload.create({
      collection: 'quizzes',
      user,
      overrideAccess: false,
      data: { ...data, ...extra },
    })
  await assert.rejects(
    payload.create({ collection: 'quizzes', overrideAccess: false, data }),
  )
  await assert.rejects(create(author, { status: 'published' }))
  await assert.rejects(create(author, { status: 'changes_requested' }))
  await assert.rejects(
    create(author, { questions: [{ ...data.questions[0], correctAnswer: 3 }] }),
  )
  const quiz = await create(author, {
    owner: other.id,
    reviewNotes: 'forged',
    status: 'in_review',
  })
  assert.equal(
    typeof quiz.owner === 'object' ? quiz.owner?.id : quiz.owner,
    author.id,
  )
  assert.ok(!quiz.reviewNotes)
  assert.equal(
    (await payload.find({ collection: 'quizzes', overrideAccess: false }))
      .totalDocs,
    0,
  )
  assert.equal(
    (
      await payload.find({
        collection: 'quizzes',
        overrideAccess: false,
        user: other,
      })
    ).totalDocs,
    0,
  )
  await assert.rejects(
    payload.update({
      collection: 'quizzes',
      id: quiz.id,
      user: other,
      overrideAccess: false,
      data: { title: 'Stolen' },
    }),
  )
  await assert.rejects(
    payload.update({
      collection: 'quizzes',
      id: quiz.id,
      user: author,
      overrideAccess: false,
      data: { status: 'published' },
    }),
  )
  const feedback = await payload.update({
    collection: 'quizzes',
    id: quiz.id,
    user: reviewer,
    overrideAccess: false,
    data: { status: 'changes_requested', reviewNotes: 'Revise a pergunta.' },
  })
  assert.equal(feedback.reviewNotes, 'Revise a pergunta.')
  await payload.update({
    collection: 'quizzes',
    id: quiz.id,
    user: author,
    overrideAccess: false,
    data: { status: 'in_review' },
  })
  const published = await payload.update({
    collection: 'quizzes',
    id: quiz.id,
    user: reviewer,
    overrideAccess: false,
    data: { status: 'published' },
  })
  assert.equal(published.status, 'published')
  const publicDoc = (
    await payload.find({ collection: 'quizzes', overrideAccess: false })
  ).docs[0]
  assert.ok(!publicDoc.owner)
  assert.ok(!publicDoc.reviewNotes)
  await assert.rejects(
    payload.find({
      collection: 'quizzes',
      user: other,
      overrideAccess: false,
      where: { reviewNotes: { equals: 'Revise a pergunta.' } },
    }),
  )
  await assert.rejects(
    payload.update({
      collection: 'quizzes',
      id: quiz.id,
      user: author,
      overrideAccess: false,
      data: { title: 'Changed live' },
    }),
  )
  await assert.rejects(
    payload.delete({
      collection: 'quizzes',
      id: quiz.id,
      user: author,
      overrideAccess: false,
    }),
  )
  await payload.update({
    collection: 'quizzes',
    id: quiz.id,
    user: reviewer,
    overrideAccess: false,
    data: { status: 'draft' },
  })
  await payload.update({
    collection: 'quizzes',
    id: quiz.id,
    user: author,
    overrideAccess: false,
    data: { title: 'Revised' },
  })
  const article = await payload.create({
    collection: 'articles',
    user: author,
    overrideAccess: false,
    draft: true,
    data: {
      title: 'Artigo',
      slug: 'artigo',
      summary: 'Resumo',
      author: 'Author',
      category: 'educacao',
      body: plainTextToLexical('Um artigo sobre as liberdades do software.'),
    },
  })
  const linked = await create(author, {
    slug: 'quiz-com-artigo',
    article: article.id,
  })
  assert.equal(
    typeof linked.article === 'object' ? linked.article?.id : linked.article,
    article.id,
  )
  await assert.rejects(
    create(other, { slug: 'artigo-alheio', article: article.id }),
  )
  await assert.rejects(
    create(author, { slug: 'artigo-ausente', article: 999999 }),
  )
  await create(author, { slug: 'quiz-independente', article: null })
  await payload.delete({
    collection: 'quizzes',
    id: linked.id,
    user: author,
    overrideAccess: false,
  })
  const privateLinked = await create(author, {
    slug: 'private-linked',
    article: article.id,
  })
  // Shared roles are authoritative; quiz editors can review without article management.
  process.env.GNUVERSE_AUTHZ_FILE = path.join(directory, 'roles.json')
  await writeFile(
    process.env.GNUVERSE_AUTHZ_FILE,
    JSON.stringify([
      {
        id: 'admin',
        identities: [{ provider: 'cms', id: String(admin.id) }],
        roles: ['admin'],
      },
      {
        id: 'quiz-editor',
        identities: [{ provider: 'cms', id: String(quizEditor.id) }],
        roles: ['quiz-editor'],
      },
    ]),
  )
  await payload.update({
    collection: 'quizzes',
    id: quiz.id,
    user: quizEditor,
    overrideAccess: false,
    data: { status: 'published' },
  })
  await payload.update({
    collection: 'quizzes',
    id: privateLinked.id,
    user: quizEditor,
    overrideAccess: false,
    data: { status: 'published' },
  })
  const { fetchPublishedQuizzes } =
    await import('../../scripts/quiz-content.mjs')
  const fetcher = (url: URL) =>
    handleEndpoints({ config, request: new Request(url) })
  let snapshot = await fetchPublishedQuizzes(
    payload.config.serverURL!,
    [],
    fetcher,
  )
  assert.ok(!snapshot.find((entry) => entry.slug === 'private-linked')?.article)
  await payload.update({
    collection: 'articles',
    id: article.id,
    user: admin,
    overrideAccess: false,
    data: { _status: 'published' },
  })
  snapshot = await fetchPublishedQuizzes(
    payload.config.serverURL!,
    [{ slug: 'artigo', title: 'Artigo' }],
    fetcher,
  )
  assert.equal(
    snapshot.find((entry) => entry.slug === 'private-linked')?.article?.slug,
    'artigo',
  )
  console.log(
    'Quizzes verified: ownership, validation, editorial permissions, private drafts, feedback, optional article and shared quiz editor.',
  )
} finally {
  await payload.destroy()
  await rm(directory, { recursive: true, force: true })
}
