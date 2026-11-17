import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  canAuthorEditSubmission,
  extractCmsErrorMessage,
  lexicalToPlainText,
  plainTextToLexical,
  slugifyTitle,
  validateSubmissionInput,
} from '../src/lib/blog-submission.ts'

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
    bodyText: 'Primeiro parágrafo.\n\nSegundo parágrafo.',
    references: [
      { label: '', url: '' },
      { label: 'GNU', url: 'https://www.gnu.org/' },
    ],
  })
  assert.equal(valid.ok, true)
  if (valid.ok) {
    assert.equal(valid.data.title, 'Software livre na prática')
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
