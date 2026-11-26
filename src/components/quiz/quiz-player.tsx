'use client'

import { useRef, useState } from 'react'
import { scoreQuiz, type PublishedQuiz } from '../../../core/quiz/quiz'

export function QuizPlayer({ quiz }: { quiz: PublishedQuiz }) {
  const [answers, setAnswers] = useState<number[]>([])
  const [score, setScore] = useState<number | null>(null)
  const resultRef = useRef<HTMLElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const answered = answers.filter((answer) => Number.isInteger(answer)).length
  return (
    <div className="mt-10">
      <p className="text-sm text-[var(--muted)]" aria-live="polite">
        {answered} de {quiz.questions.length} perguntas respondidas
      </p>
      <progress
        value={answered}
        max={quiz.questions.length}
        aria-label="Progresso do quiz"
        className="mt-3 h-1.5 w-full accent-[var(--accent)]"
      />
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault()
          setScore(scoreQuiz(quiz.questions, answers))
          requestAnimationFrame(() => {
            resultRef.current?.focus()
            resultRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          })
        }}
        className="mt-8 space-y-6"
      >
        {quiz.questions.map((question, index) => (
          <fieldset
            key={index}
            disabled={score !== null}
            className="rounded-sm border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7"
          >
            <legend className="max-w-full px-2 text-lg font-medium">
              <span className="mr-2 text-[var(--accent)]">
                {String(index + 1).padStart(2, '0')}.
              </span>
              {question.prompt}
            </legend>
            <div className="space-y-3">
              {question.choices.map((choice, choiceIndex) => (
                <label
                  key={choiceIndex}
                  className={`flex cursor-pointer items-start gap-3 rounded-sm border p-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)] ${answers[index] === choiceIndex ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] hover:border-[var(--muted)]'}`}
                >
                  <input
                    type="radio"
                    required
                    name={`question-${index}`}
                    checked={answers[index] === choiceIndex}
                    onChange={() =>
                      setAnswers((current) => {
                        const next = [...current]
                        next[index] = choiceIndex
                        return next
                      })
                    }
                    className="mt-1 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="text-sm leading-relaxed">{choice.text}</span>
                </label>
              ))}
            </div>
            {score !== null && (
              <div className="mt-5 border-t border-[var(--line)] pt-4">
                <p
                  className={
                    answers[index] === question.correctAnswer
                      ? 'font-medium text-[var(--accent)]'
                      : 'font-medium text-[var(--secondary)]'
                  }
                >
                  {answers[index] === question.correctAnswer
                    ? 'Você acertou!'
                    : 'Vamos aprender com esta?'}
                </p>
                <p className="mt-2 text-sm">
                  Resposta correta:{' '}
                  {question.choices[question.correctAnswer].text}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted)]">
                  {question.explanation}
                </p>
              </div>
            )}
          </fieldset>
        ))}
        {score === null && (
          <button
            type="submit"
            className="cursor-pointer rounded-sm bg-[var(--accent)] px-6 py-3 font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]"
          >
            Conferir respostas
          </button>
        )}
      </form>
      {score !== null && (
        <section
          ref={resultRef}
          tabIndex={-1}
          aria-label="Resultado do quiz"
          className="mt-8 scroll-mt-24 rounded-sm border border-[var(--accent)] bg-[var(--accent-soft)] p-6"
        >
          <p className="text-xs uppercase tracking-widest text-[var(--accent)]">
            Seu percurso
          </p>
          <h2 className="mt-3 text-3xl">
            {score} de {quiz.questions.length}{' '}
            {score === 1 ? 'acerto' : 'acertos'}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            {score === quiz.questions.length
              ? 'Muito bem! Continue explorando e compartilhando o que aprendeu.'
              : 'Cada pergunta é uma oportunidade. Confira as explicações e experimente de novo.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setAnswers([])
              setScore(null)
              requestAnimationFrame(() => {
                formRef.current?.scrollIntoView({ behavior: 'smooth' })
                formRef.current
                  ?.querySelector<HTMLInputElement>('input')
                  ?.focus()
              })
            }}
            className="mt-5 cursor-pointer rounded-sm border border-[var(--accent)] px-4 py-2 text-sm text-[var(--accent)] hover:bg-[var(--surface)]"
          >
            Tentar novamente
          </button>
        </section>
      )}
    </div>
  )
}
