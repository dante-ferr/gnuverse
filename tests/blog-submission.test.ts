import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  canAuthorEditSubmission,
  extractCmsErrorMessage,
  formatHashtagsInput,
  lexicalToPlainText,
  parseHashtagsInput,
  plainTextToLexical,
  slugifyTitle,
  validateSubmissionInput,
} from '../src/lib/blog-submission.ts'
import {
  filterAndSortArticles,
  getBlogPageHref,
  hasActiveExplorerFilters,
  paginateArticles,
} from '../src/lib/blog-explorer.ts'
import type { Article } from '../src/lib/article-meta.ts'

test('slugifyTitle normaliza acentos e pontuação para slugs válidos', () => {
  assert.equal(slugifyTitle('Olá, GNUverse!'), 'ola-gnuverse')
  assert.equal(
    slugifyTitle('Educação & Software Livre (2026)'),
    'educacao-software-livre-2026',
  )
  assert.equal(slugifyTitle('   ---   '), '')
})

test('plainTextToLexical gera estrutura idêntica ao demo-article.json e faz round-trip', async () => {
  const demo = JSON.parse(
    await readFile(new URL('../content/demo-article.json', import.meta.url), 'utf8'),
  )
  const text = lexicalToPlainText(demo.body)
  assert.deepEqual(plainTextToLexical(text), demo.body)
})

test('validateSubmissionInput valida slug, resumo, corpo e referências HTTP/HTTPS', () => {
  const invalidSlug = validateSubmissionInput({
    title: 'Teste',
    slug: 'Slug Inválido',
    summary: 'Resumo',
    author: 'Ana',
    category: 'reflexoes',
    hashtags: [],
    bodyText: 'Parágrafo um.',
    references: [],
  })
  assert.equal(invalidSlug.ok, false)

  const invalidRef = validateSubmissionInput({
    title: 'Teste',
    slug: 'teste-valido',
    summary: 'Resumo',
    author: 'Ana',
    category: 'acesso',
    hashtags: [],
    bodyText: 'Parágrafo um.',
    references: [{ label: 'Fonte', url: 'javascript:alert(1)' }],
  })
  assert.equal(invalidRef.ok, false)

  const valid = validateSubmissionInput({
    title: '  Software livre na prática ',
    slug: 'software-livre-na-pratica',
    summary: 'Resumo conciso.',
    author: 'Ana',
    category: 'educacao',
    hashtags: ['#Educação', 'software-livre', 'educacao'],
    bodyText: 'Primeiro parágrafo.\n\nSegundo parágrafo.',
    references: [
      { label: '', url: '' },
      { label: 'GNU', url: 'https://www.gnu.org/' },
    ],
  })
  assert.equal(valid.ok, true)
  if (valid.ok) {
    assert.equal(valid.data.title, 'Software livre na prática')
    assert.deepEqual(valid.data.hashtags, ['educacao', 'software-livre'])
    assert.equal(valid.data.body.root.children.length, 2)
    assert.deepEqual(valid.data.references, [
      { label: 'GNU', url: 'https://www.gnu.org/' },
    ])
  }
})

test('canAuthorEditSubmission permite editar apenas rascunho ou ajustes solicitados não publicados', () => {
  assert.equal(canAuthorEditSubmission({ _status: 'draft', reviewStatus: 'draft' }), true)
  assert.equal(
    canAuthorEditSubmission({ _status: 'draft', reviewStatus: 'changes_requested' }),
    true,
  )
  assert.equal(
    canAuthorEditSubmission({ _status: 'draft', reviewStatus: 'in_review' }),
    false,
  )
  assert.equal(
    canAuthorEditSubmission({ _status: 'draft', reviewStatus: 'approved' }),
    false,
  )
  assert.equal(
    canAuthorEditSubmission({ _status: 'published', reviewStatus: 'approved' }),
    false,
  )
})

test('extractCmsErrorMessage prioriza mensagens de validação do Payload', () => {
  const message = extractCmsErrorMessage(
    {
      errors: [
        {
          message: 'The following field is invalid: slug',
          data: { errors: [{ message: 'Slug já em uso.', path: 'slug' }] },
        },
      ],
    },
    400,
  )
  assert.equal(message, 'Slug já em uso.')
  assert.match(extractCmsErrorMessage(null, 401), /sessão expirada/i)
})

test('parseHashtagsInput e formatHashtagsInput normalizam, deduplicam e limitam a 10 tags', () => {
  assert.deepEqual(
    parseHashtagsInput('#Educação, software_livre #educacao gnu! @@@ #a #b #c #d #e #f #g #h #i'),
    ['educacao', 'software_livre', 'gnu', 'a', 'b', 'c', 'd', 'e', 'f', 'g'],
  )
  assert.equal(
    formatHashtagsInput([{ tag: 'softwarelivre' }, 'educacao', { tag: '#gnu' }]),
    '#softwarelivre, #educacao, #gnu',
  )
  assert.equal(formatHashtagsInput(undefined), '')
})

test('blog-explorer filtra por busca, ordena por data e pagina', () => {
  const emptyBody = plainTextToLexical('Conteúdo.')
  const sample: Article[] = [
    {
      title: 'Zebra Livre',
      slug: 'zebra-livre',
      summary: 'Texto sobre autonomia.',
      author: 'Ana',
      category: 'reflexoes',
      hashtags: ['autonomia', 'gnu'],
      publishedAt: '2026-11-12T10:00:00Z',
      body: emptyBody,
      references: [],
    },
    {
      title: 'Educação Aberta',
      slug: 'educacao-aberta',
      summary: 'Oficinas na escola.',
      author: 'Beto',
      category: 'educacao',
      hashtags: ['educacao', 'gnu'],
      publishedAt: '2026-10-25T10:00:00Z',
      body: emptyBody,
      references: [],
    },
    {
      title: 'Acesso Comunitário',
      slug: 'acesso-comunitario',
      summary: 'Redes livres no bairro.',
      author: 'Carla',
      category: 'acesso',
      hashtags: ['redes'],
      publishedAt: '2025-05-01T10:00:00Z',
      body: emptyBody,
      references: [],
    },
  ]

  assert.equal(
    hasActiveExplorerFilters({
      query: '',
      sort: 'recent',
    }),
    false,
  )
  assert.equal(
    hasActiveExplorerFilters({
      query: 'gnu',
      sort: 'recent',
    }),
    true,
  )
  assert.equal(
    hasActiveExplorerFilters({
      query: '',
      sort: 'oldest',
    }),
    true,
  )

  const byAccentQuery = filterAndSortArticles(sample, {
    query: 'educacao',
    sort: 'recent',
  })
  assert.deepEqual(
    byAccentQuery.map((a) => a.slug),
    ['educacao-aberta'],
  )

  const byHashtagQuery = filterAndSortArticles(sample, {
    query: '#gnu',
    sort: 'recent',
  })
  assert.deepEqual(
    byHashtagQuery.map((a) => a.slug),
    ['zebra-livre', 'educacao-aberta'],
  )

  const byOldest = filterAndSortArticles(sample, {
    query: '',
    sort: 'oldest',
  })
  assert.deepEqual(
    byOldest.map((a) => a.slug),
    ['acesso-comunitario', 'educacao-aberta', 'zebra-livre'],
  )

  const page1 = paginateArticles(sample, 1, 2)
  assert.equal(page1.totalPages, 2)
  assert.equal(page1.items.length, 2)
  const page2 = paginateArticles(sample, 2, 2)
  assert.equal(page2.items.length, 1)
  assert.equal(page2.items[0].slug, 'acesso-comunitario')

  assert.equal(getBlogPageHref(1), '/blog/')
  assert.equal(getBlogPageHref(2), '/blog/pagina/2/')
})
