import Link from 'next/link'
import { getContent } from '@/lib/articles'
import { QuizCards } from '@/components/quiz/quiz-cards'

export const metadata = {
  title: 'Quizzes — GNUverse',
  description: 'Aprenda sobre software livre com quizzes da comunidade.',
}
export default async function QuizzesPage() {
  const { quizzes, mode } = await getContent()
  return (
    <main className="[overflow-wrap:anywhere] mx-auto min-h-svh max-w-6xl px-6 py-10 sm:px-12">
      <Link
        href="/"
        className="text-sm text-[var(--accent)] underline underline-offset-4"
      >
        ← GNUverse
      </Link>
      <header className="mt-16 border-b border-[var(--line)] pb-8">
        <p className="text-xs uppercase tracking-widest text-[var(--accent)]">
          Conhecimento em movimento
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
          <h1 className="text-4xl tracking-tight sm:text-5xl">
            Uma pergunta abre caminhos.
          </h1>
          <Link
            href="/quizzes/criar/"
            className="rounded-sm bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]"
          >
            Criar ou editar quiz
          </Link>
        </div>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          Explore ideias, teste o que aprendeu e descubra novas perspectivas.
          Responda livremente, sem precisar de uma conta.
        </p>
        {mode === 'demo' && (
          <p className="mt-5 text-sm text-[var(--muted)]">
            Demonstração local: este quiz é um exemplo e ainda não veio do CMS.
          </p>
        )}
      </header>
      {quizzes.length ? (
        <QuizCards quizzes={quizzes} />
      ) : (
        <p className="mt-10 text-[var(--muted)]">
          Ainda não há quizzes publicados. Que tal preparar o primeiro?
        </p>
      )}
    </main>
  )
}
