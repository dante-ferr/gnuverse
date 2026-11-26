import { validateQuiz } from '../core/quiz/quiz.ts'

/** Copies only public learning content; no accounts or editorial feedback enter the static site. */
export function publicQuiz(doc, articles) {
  if (doc.status !== 'published')
    throw new Error('A API retornou um quiz não publicado.')
  if (
    typeof doc.slug !== 'string' ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc.slug) ||
    doc.slug === 'criar'
  )
    throw new Error('Endereço de quiz inválido no CMS.')
  const error = validateQuiz(doc)
  if (error) throw new Error(`Quiz inválido: ${error}`)
  const related =
    typeof doc.article === 'object' && doc.article
      ? articles.find((article) => article.slug === doc.article.slug)
      : undefined
  return {
    title: doc.title,
    slug: doc.slug,
    summary: doc.summary,
    questions: doc.questions.map((q) => ({
      prompt: q.prompt,
      choices: q.choices.map((choice) => ({ text: choice.text })),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    })),
    ...(related
      ? { article: { slug: related.slug, title: related.title } }
      : {}),
  }
}

export async function fetchPublishedQuizzes(
  baseURL,
  articles,
  fetcher = fetch,
) {
  const base = new URL(baseURL)
  if (!['http:', 'https:'].includes(base.protocol))
    throw new Error('CMS_URL precisa ser HTTP ou HTTPS.')
  const quizzes = []
  const slugs = new Set()
  for (let page = 1; page <= 100; page++) {
    const url = new URL('/api/quizzes', base)
    url.search = new URLSearchParams({
      'where[status][equals]': 'published',
      depth: '1',
      limit: '100',
      page: String(page),
      sort: '-createdAt',
    }).toString()
    const response = await fetcher(url, { signal: AbortSignal.timeout(120000) })
    if (!response.ok)
      throw new Error(
        `Não foi possível sincronizar quizzes (HTTP ${response.status}).`,
      )
    const data = await response.json()
    if (!Array.isArray(data.docs))
      throw new Error('Resposta de quizzes inválida do CMS.')
    for (const doc of data.docs) {
      const quiz = publicQuiz(doc, articles)
      if (slugs.has(quiz.slug))
        throw new Error('O CMS retornou quizzes com endereços duplicados.')
      slugs.add(quiz.slug)
      quizzes.push(quiz)
    }
    if (!data.hasNextPage) return quizzes
  }
  throw new Error('Limite de paginação de quizzes excedido.')
}
