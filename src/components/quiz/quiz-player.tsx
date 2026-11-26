'use client'

import { useRef, useState } from 'react'
import { scoreQuiz, type PublishedQuiz } from '../../../core/quiz/quiz'
import Link from 'next/link'
import { useGameSession } from '@/components/game/hooks/use-game-session'
import { resolveGameApiUrl } from '@/components/game/api/game-api'
import { rewardsApi, type QuizClaimResult } from '@/lib/rewards-client'

export function QuizPlayer({ quiz }: { quiz: PublishedQuiz }) {
  const [answers, setAnswers] = useState<number[]>([])
  const [score, setScore] = useState<number | null>(null)
  const { api, token, setWallet } = useGameSession()
  const [reward, setReward] = useState<QuizClaimResult | { error: string } | null>(null)
  const resultRef = useRef<HTMLElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const answered = answers.filter((answer) => Number.isInteger(answer)).length
  const progressPercent = quiz.questions.length
    ? Math.round((answered / quiz.questions.length) * 100)
    : 0

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-4 text-xs text-[var(--muted)]">
        <p aria-live="polite" className="tabular-nums">
          {answered} de {quiz.questions.length}{' '}
          {quiz.questions.length === 1
            ? 'pergunta respondida'
            : 'perguntas respondidas'}
        </p>
        <span className="font-mono tabular-nums text-[var(--muted)]">
          {progressPercent}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Progresso do quiz"
        aria-valuenow={answered}
        aria-valuemin={0}
        aria-valuemax={quiz.questions.length}
        className="mt-2.5 h-1.5 w-full overflow-hidden rounded-md bg-[var(--surface-raised)]"
      >
        <div
          className="h-full rounded-md bg-[var(--accent)] transition-[width] duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault()
          setScore(scoreQuiz(quiz.questions, answers))
          setReward(null)
          if (token && resolveGameApiUrl())
            rewardsApi
              .claimQuiz(api, quiz.slug, answers)
              .then((result) => {
                setWallet(result.wallet)
                setReward(result)
              })
              .catch((error: Error) => setReward({ error: error.message }))
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
            className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7"
          >
            <legend className="max-w-full px-1 text-base font-semibold leading-snug text-[var(--ink)] sm:text-lg">
              <span className="mr-2 font-mono text-sm font-medium tabular-nums text-[var(--accent)]">
                {String(index + 1).padStart(2, '0')}.
              </span>
              {question.prompt}
            </legend>

            <div className="mt-4 space-y-2.5">
              {question.choices.map((choice, choiceIndex) => {
                const isSelected = answers[index] === choiceIndex
                const isCorrect =
                  score !== null && choiceIndex === question.correctAnswer
                const isWrongSelected =
                  score !== null && isSelected && choiceIndex !== question.correctAnswer

                const choiceStyle = isCorrect
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]'
                  : isWrongSelected
                    ? 'border-[var(--secondary)] bg-[var(--secondary-soft)] text-[var(--ink)]'
                    : score !== null
                      ? 'border-[var(--line)] bg-[var(--background)] text-[var(--muted)] opacity-75'
                      : isSelected
                        ? 'border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--ink)]'
                        : 'border-[var(--line)] bg-[var(--background)] text-[var(--ink)] hover:border-[var(--muted)] hover:bg-[var(--surface-raised)]'

                return (
                  <label
                    key={choiceIndex}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)] ${choiceStyle}`}
                  >
                    <input
                      type="radio"
                      required
                      name={`question-${index}`}
                      checked={isSelected}
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
                )
              })}
            </div>

            {score !== null && (
              <div className="mt-5 rounded-md border border-[var(--line)] bg-[var(--background)] p-4">
                <p
                  className={
                    answers[index] === question.correctAnswer
                      ? 'text-sm font-semibold text-[var(--accent)]'
                      : 'text-sm font-semibold text-[var(--secondary)]'
                  }
                >
                  {answers[index] === question.correctAnswer
                    ? 'Você acertou!'
                    : 'Vamos aprender com esta?'}
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
            className="cursor-pointer rounded-md border border-[var(--accent)] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--on-accent)] transition hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)]"
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
          className="mt-8 scroll-mt-24 rounded-md border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-7"
        >
          <p className="inline-flex items-center gap-2 text-xs font-medium text-[var(--secondary)]">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[var(--secondary)]"
            />
            Resultado
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)] tabular-nums">
            {score} de {quiz.questions.length}{' '}
            {score === 1 ? 'acerto' : 'acertos'}
          </h2>
          <p className="mt-2.5 max-w-[58ch] text-sm leading-relaxed text-[var(--muted)]">
            {score === quiz.questions.length
              ? 'Muito bem! Continue explorando e compartilhando o que aprendeu.'
              : 'Cada pergunta é uma oportunidade. Confira as explicações e experimente de novo.'}
          </p>
          <p className="mt-3 text-sm leading-relaxed" aria-live="polite">
            {!token ? (
              <>
                <Link href="/login/" className="text-[var(--accent)] underline underline-offset-4">
                  Entre
                </Link>{' '}
                para ganhar moedas do jogo por respostas corretas.
              </>
            ) : reward && 'error' in reward ? (
              reward.error
            ) : reward ? (
              reward.awarded > 0 ? (
                <span className="text-[var(--accent)]">
                  +{reward.awarded} moedas de recompensa
                  {reward.bonus > 0 ? ` (incluindo ${reward.bonus} pelo quiz perfeito)` : ''}!
                </span>
              ) : (
                <span className="text-[var(--muted)]">
                  Sem novas moedas: você já recebeu as recompensas das perguntas que acertou.
                </span>
              )
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => {
              setAnswers([])
              setScore(null)
              setReward(null)
              requestAnimationFrame(() => {
                formRef.current?.scrollIntoView({ behavior: 'smooth' })
                formRef.current
                  ?.querySelector<HTMLInputElement>('input')
                  ?.focus()
              })
            }}
            className="mt-5 cursor-pointer rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--muted)]"
          >
            Tentar novamente
          </button>
        </section>
      )}
    </div>
  )
}
