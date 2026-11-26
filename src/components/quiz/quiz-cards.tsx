import Link from 'next/link'
import type { PublishedQuiz } from '../../../core/quiz/quiz'

export function QuizCards({ quizzes }: { quizzes: PublishedQuiz[] }) {
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2">
      {quizzes.map((quiz) => (
        <article
          key={quiz.slug}
          className="article-card flex flex-col border border-[var(--line)] bg-[var(--surface)] p-6"
        >
          <p className="text-xs uppercase tracking-widest text-[var(--accent)]">
            {quiz.questions.length}{' '}
            {quiz.questions.length === 1 ? 'pergunta' : 'perguntas'} ·{' '}
            {quiz.article
              ? 'Para continuar a leitura'
              : 'Explore por conta própria'}
          </p>
          <h2 className="mt-4 text-2xl">
            <Link
              href={`/quizzes/${quiz.slug}/`}
              className="hover:text-[var(--accent)]"
            >
              {quiz.title}
            </Link>
          </h2>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--muted)]">
            {quiz.summary}
          </p>
          {quiz.article && (
            <Link
              href={`/artigos/${quiz.article.slug}/`}
              className="mt-4 text-sm text-[var(--accent)] underline underline-offset-4"
            >
              Ler: {quiz.article.title}
            </Link>
          )}
          <Link
            href={`/quizzes/${quiz.slug}/`}
            className="mt-6 self-start rounded-sm border border-[var(--accent)] px-4 py-2 text-sm text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
          >
            Responder quiz →
          </Link>
        </article>
      ))}
    </div>
  )
}
