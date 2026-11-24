import assert from 'node:assert/strict'
import { test } from 'node:test'
import { publicQuiz, fetchPublishedQuizzes } from '../scripts/quiz-content.mjs'

const doc = {
  status: 'published',
  title: 'Quiz',
  slug: 'quiz',
  summary: 'Resumo',
  owner: 7,
  titleKey: 'quiz',
  reviewNotes: 'Privado',
  questions: [
    {
      id: 'private-id',
      prompt: 'Pergunta?',
      choices: [{ text: 'Sim', id: 'a' }, { text: 'Não' }],
      correctAnswer: 0,
      explanation: 'Motivo.',
    },
  ],
}
test('static snapshots keep only public fields and link only articles in the published snapshot', () => {
  const quiz = publicQuiz(
    { ...doc, article: { slug: 'artigo', title: 'Artigo secreto' } },
    [],
  )
  assert.equal(quiz.article, undefined)
  assert.equal(quiz.owner, undefined)
  assert.equal(quiz.titleKey, undefined)
  assert.equal(quiz.reviewNotes, undefined)
  assert.equal(quiz.questions[0].id, undefined)
  assert.equal(quiz.questions[0].choices[0].id, undefined)
  assert.deepEqual(
    publicQuiz({ ...doc, article: { slug: 'artigo' } }, [
      { slug: 'artigo', title: 'Título público' },
    ]).article,
    { slug: 'artigo', title: 'Título público' },
  )
  assert.throws(
    () => publicQuiz({ ...doc, status: 'draft' }, []),
    /não publicado/,
  )
  assert.throws(() => publicQuiz({ ...doc, questions: [] }, []), /inválido/)
  assert.throws(
    () => publicQuiz({ ...doc, slug: '../invalid' }, []),
    /inválido/,
  )
})
test('sync paginates and refuses outages, malformed responses and duplicate slugs', async () => {
  const pages = []
  const fetcher = async (url) => {
    const page = url.searchParams.get('page')
    pages.push(page)
    assert.equal(url.searchParams.get('where[status][equals]'), 'published')
    return Response.json({
      docs: [{ ...doc, slug: `quiz-${page}` }],
      hasNextPage: page === '1',
    })
  }
  assert.equal(
    (await fetchPublishedQuizzes('http://cms.test', [], fetcher)).length,
    2,
  )
  assert.deepEqual(pages, ['1', '2'])
  await assert.rejects(
    fetchPublishedQuizzes(
      'http://cms.test',
      [],
      async () => new Response('', { status: 503 }),
    ),
    /503/,
  )
  await assert.rejects(
    fetchPublishedQuizzes('http://cms.test', [], async () => Response.json({})),
    /inválida/,
  )
  await assert.rejects(
    fetchPublishedQuizzes('http://cms.test', [], async () =>
      Response.json({ docs: [doc, doc] }),
    ),
    /duplicados/,
  )
})
