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
      <header className="border-b border-[var(--line)] pt-2 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[60ch]">
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--ink)] sm:text-5xl">
              Uma pergunta abre caminhos.
            </h1>
            <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">
              Explore ideias, teste o que aprendeu e descubra novas
              perspectivas. Responda livremente, sem precisar de uma conta.
            </p>
          </div>
          <Link
            href="/quizzes/criar/"
            className="inline-flex shrink-0 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--muted)] hover:bg-[var(--surface-raised)]"
          >
            Criar ou editar quiz
          </Link>
        </div>
        {mode === 'demo' && (
          <p className="mt-6 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
            Modo demonstração: estes quizzes são exemplos locais e ainda não
            vieram do CMS.
          </p>
        )}
      </header>

      {quizzes.length ? (
        <QuizCards quizzes={quizzes} />
      ) : (
        <div className="mt-10 rounded-md border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-12 text-center sm:px-10">
          <p className="text-base font-medium text-[var(--ink)]">
            Ainda não há quizzes publicados.
          </p>
          <p className="mx-auto mt-2 max-w-[48ch] text-sm leading-relaxed text-[var(--muted)]">
            Que tal preparar o primeiro quiz para compartilhar com a turma e
            aprofundar os temas do blog?
          </p>
          <Link
            href="/quizzes/criar/"
            className="mt-6 inline-flex items-center rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--muted)]"
          >
            Criar primeiro quiz
          </Link>
        </div>
      )}
    </main>
  )
}
