/** Learning quizzes are self-assessments, not exams or a source of game rewards. */
export type QuizQuestion = {
  prompt: string
  choices: { text: string }[]
  correctAnswer: number
  explanation: string
}
export type QuizInput = {
  title: string
  summary: string
  questions: QuizQuestion[]
}
export type PublishedQuiz = QuizInput & {
  slug: string
  article?: { slug: string; title: string }
}
export const QUIZ_STATUS_LABELS = {
  draft: 'Rascunho',
  in_review: 'Em revisão',
  changes_requested: 'Ajustes solicitados',
  published: 'Publicado',
} as const
export type QuizStatus = keyof typeof QUIZ_STATUS_LABELS

/** Name comparisons ignore casing and repeated surrounding/internal whitespace. */
export function normalizeQuizTitle(title: string): string {
  return title.normalize('NFC').trim().replace(/\s+/g, ' ')
}

/** Creates a URL segment from the name, keeping the contributor form free of routing fields. */
export function quizSlug(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug === 'criar' ? 'quiz-criar' : slug
}

/** Shared by the CMS, contributor form and static content synchronizer. */
export function validateQuiz(input: unknown): string | null {
  if (!input || typeof input !== 'object') return 'Preencha o quiz.'
  const quiz = input as Record<string, unknown>
  for (const [key, label, max] of [
    ['title', 'O título', 160],
    ['summary', 'O resumo', 300],
  ] as const) {
    const value = quiz[key]
    if (typeof value !== 'string' || !value.trim() || value.length > max)
      return `${label} é obrigatório e deve ter até ${max} caracteres.`
  }
  if (!quizSlug(quiz.title as string))
    return 'Use pelo menos uma letra ou número no título.'
  if (
    !Array.isArray(quiz.questions) ||
    quiz.questions.length < 1 ||
    quiz.questions.length > 30
  )
    return 'Inclua de 1 a 30 perguntas.'
  for (const [index, question] of quiz.questions.entries()) {
    const prefix = `Pergunta ${index + 1}: `
    if (!question || typeof question !== 'object')
      return prefix + 'preencha a pergunta.'
    if (
      typeof question.prompt !== 'string' ||
      !question.prompt.trim() ||
      question.prompt.length > 1000
    )
      return prefix + 'preencha o enunciado (até 1.000 caracteres).'
    if (
      !Array.isArray(question.choices) ||
      question.choices.length < 2 ||
      question.choices.length > 6
    )
      return prefix + 'inclua de 2 a 6 alternativas.'
    const labels = new Set<string>()
    for (const choice of question.choices) {
      if (
        !choice ||
        typeof choice.text !== 'string' ||
        !choice.text.trim() ||
        choice.text.length > 300
      )
        return (
          prefix + 'preencha todas as alternativas (até 300 caracteres cada).'
        )
      const label = choice.text.trim().toLocaleLowerCase('pt-BR')
      if (labels.has(label))
        return prefix + 'as alternativas precisam ser diferentes.'
      labels.add(label)
    }
    if (
      !Number.isInteger(question.correctAnswer) ||
      question.correctAnswer < 0 ||
      question.correctAnswer >= question.choices.length
    )
      return prefix + 'selecione uma alternativa correta.'
    if (
      typeof question.explanation !== 'string' ||
      !question.explanation.trim() ||
      question.explanation.length > 2000
    )
      return prefix + 'explique a resposta (até 2.000 caracteres).'
  }
  return null
}

/** Refuses incomplete attempts rather than silently counting missing answers as wrong. */
export function scoreQuiz(
  questions: QuizQuestion[],
  answers: number[],
): number {
  if (
    answers.length !== questions.length ||
    questions.some(
      (q, i) =>
        !Number.isInteger(answers[i]) ||
        answers[i] < 0 ||
        answers[i] >= q.choices.length,
    )
  )
    throw new Error(
      'Responda todas as perguntas antes de conferir o resultado.',
    )
  return questions.filter(
    (question, index) => question.correctAnswer === answers[index],
  ).length
}
