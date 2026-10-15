import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fetchPublishedArticles, validateArticle } from '../scripts/cms-content.mjs'

const example = JSON.parse(await readFile(new URL('../content/demo-article.json', import.meta.url)))
const published = { ...example, _status: 'published' }

test('rascunhos não podem entrar na exportação e slugs não podem escapar da rota', () => {
  assert.throws(() => validateArticle({ ...published, _status: 'draft' }), /não publicado/)
  assert.throws(() => validateArticle({ ...published, slug: '../admin' }), /Slug/)
  assert.throws(() => validateArticle({ ...published, references: [{ label: 'x', url: 'javascript:alert(1)' }] }), /Referência/)
})

test('lê todas as páginas com filtro de publicação, sem credenciais de usuário', async () => {
  const urls = []
  const articles = await fetchPublishedArticles('https://cms.example.test', async (url, options) => {
    urls.push(url)
    assert.equal(options.headers, undefined)
    const page = Number(url.searchParams.get('page'))
    return Response.json({ docs: [{ ...published, slug: `artigo-${page}` }], hasNextPage: page === 1 })
  })
  assert.equal(articles.length, 2)
  assert.equal(urls[0].searchParams.get('where[_status][equals]'), 'published')
})

test('falha de CMS aborta a publicação em vez de substituir por conteúdo demo', async () => {
  await assert.rejects(fetchPublishedArticles('https://cms.example.test', async () => new Response('', { status: 503 })), /indisponível/)
})
