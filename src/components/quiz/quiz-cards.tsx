import Link from 'next/link'
import type { PublishedQuiz } from '../../../core/quiz/quiz'

export function QuizCards({ quizzes }: { quizzes: PublishedQuiz[] }) {
  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2">
      {quizzes.map((quiz) => (
        <article
          key={quiz.slug}
          className="article-card flex flex-col rounded-md border border-[var(--line)] bg-[var(--surface)] p-6 transition-colors hover:border-[var(--muted)] focus-within:border-[var(--accent)]"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--background)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[var(--secondary)]"
              />
              {quiz.article ? 'Ligado a artigo' : 'Quiz independente'}
            </span>
            <span className="tabular-nums">
              {quiz.questions.length}{' '}
              {quiz.questions.length === 1 ? 'pergunta' : 'perguntas'}
            </span>
          </div>

          <h2 className="mt-4 text-xl font-semibold leading-snug tracking-tight text-[var(--ink)]">
            <Link
              href={`/quizzes/${quiz.slug}/`}
              className="transition-colors hover:text-[var(--accent)]"
            >
              {quiz.title}
            </Link>
          </h2>

          <p className="mt-2.5 flex-1 text-sm leading-relaxed text-[var(--muted)]">
            {quiz.summary}
          </p>

          {quiz.article && (
            <p className="mt-4 text-xs text-[var(--muted)]">
              Artigo relacionado:{' '}
              <Link
                href={`/artigos/${quiz.article.slug}/`}
                className="text-[var(--accent)] underline underline-offset-4"
              >
                {quiz.article.title}
              </Link>
            </p>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-[var(--line)] pt-4">
            <Link
              href={`/quizzes/${quiz.slug}/`}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-3.5 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <span>Responder quiz</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article>
      ))}
    </div>
  )
}
