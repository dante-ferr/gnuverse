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
      <header className="mt-16">
        <p className="text-xs uppercase tracking-widest text-[var(--accent)]">
          Aprender e compartilhar · {quiz.questions.length} perguntas
        </p>
        <h1 className="mt-4 text-4xl leading-tight tracking-tight sm:text-5xl">
          {quiz.title}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-[var(--muted)]">
          {quiz.summary}
        </p>
        {quiz.article && (
          <Link
            href={`/artigos/${quiz.article.slug}/`}
            className="mt-5 inline-block text-sm text-[var(--accent)] underline underline-offset-4"
          >
            Antes de começar, leia: {quiz.article.title} ↗
          </Link>
        )}
        <p className="mt-4 text-xs text-[var(--muted)]">
          Uma resposta por pergunta. Sem cronômetro; seu resultado fica apenas
          nesta página.
        </p>
      </header>
      <QuizPlayer quiz={quiz} />
    </main>
  )
}
