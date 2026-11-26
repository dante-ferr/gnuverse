import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getContent } from '@/lib/articles'
import { QuizPlayer } from '@/components/quiz/quiz-player'

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const { quizzes } = await getContent()
  return quizzes.length
    ? quizzes.map(({ slug }) => ({ slug }))
    : [{ slug: '__empty' }]
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const quiz = (await getContent()).quizzes.find((entry) => entry.slug === slug)
  return {
    title: quiz ? `${quiz.title} — GNUverse` : 'Quiz — GNUverse',
    description: quiz?.summary,
  }
}

export default async function QuizPage({ params }: Props) {
  const { slug } = await params
  const quiz = (await getContent()).quizzes.find((entry) => entry.slug === slug)
  if (!quiz) notFound()
  return (
    <main className="[overflow-wrap:anywhere] mx-auto min-h-svh max-w-3xl px-6 py-10 sm:px-12">
      <Link
        href="/quizzes/"
        className="text-sm text-[var(--accent)] underline underline-offset-4"
      >
        ← Todos os quizzes
      </Link>
      <header className="mt-10 border-b border-[var(--line)] pb-8">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[var(--muted)]">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[var(--secondary)]"
            />
            <span className="tabular-nums">
              {quiz.questions.length}{' '}
              {quiz.questions.length === 1 ? 'pergunta' : 'perguntas'}
            </span>
          </span>
          {quiz.article && (
            <Link
              href={`/artigos/${quiz.article.slug}/`}
              className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[var(--accent)] transition hover:border-[var(--muted)]"
            >
              Artigo: {quiz.article.title} ↗
            </Link>
          )}
        </div>
        <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--ink)] sm:text-5xl">
          {quiz.title}
        </h1>
        <p className="mt-4 max-w-[64ch] text-base leading-relaxed text-[var(--muted)]">
          {quiz.summary}
        </p>
        <p className="mt-4 text-xs text-[var(--muted)]">
          Uma resposta por pergunta. Sem cronômetro; seu resultado fica apenas
          nesta página.
        </p>
      </header>
      <QuizPlayer quiz={quiz} />
    </main>
  )
}
