'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameSession } from '@/components/game/hooks/use-game-session'
import { quizCollection, quizRequest } from '@/lib/quiz-client'
import {
  QUIZ_STATUS_LABELS,
  validateQuiz,
  type QuizInput,
  type QuizQuestion,
  type QuizStatus,
} from '../../../core/quiz/quiz'

type Draft = QuizInput & {
  id: number | string
  article?: number | string | null
  status: QuizStatus
  reviewNotes?: string
}
type ArticleOption = { id: number | string; title: string; _status?: string }
const inputClass =
  'mt-2 w-full rounded-sm border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 text-sm focus:border-[var(--accent)]'
const buttonClass =
  'cursor-pointer rounded-sm border border-[var(--line)] px-3 py-2 text-sm text-[var(--accent)] hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50'
const newQuestion = (): QuizQuestion => ({
  prompt: '',
  choices: [{ text: '' }, { text: '' }],
  correctAnswer: 0,
  explanation: '',
})
const emptyQuiz = (): QuizInput => ({
  title: '',
  summary: '',
  questions: [newQuestion()],
})

export function QuizEditor() {
  const { token } = useGameSession()
  const [quiz, setQuiz] = useState<QuizInput>(emptyQuiz)
  const [article, setArticle] = useState('')
  const [returnPath, setReturnPath] = useState('/quizzes/criar/')
  const articlePrefilled = useRef(false)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [articles, setArticles] = useState<ArticleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const savedRevision = useRef(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const currentToken = useRef(token)
  currentToken.current = token

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) {
        setLoading(false)
        return
      }
      setLoading(true)
      setLoadError('')
      const revision = savedRevision.current
      const deadline = AbortSignal.timeout(15000)
      const readSignal = signal ? AbortSignal.any([signal, deadline]) : deadline
      const active = () => !signal?.aborted && currentToken.current === token
      // Each list can become usable independently; neither blocks the authoring form.
      const results = await Promise.allSettled([
        (async () => {
          const { user } = await quizRequest<{ user: { id: number | string } }>(
            'users/me',
            token,
            { signal: readSignal },
          )
          if (!user) throw new Error('Entre novamente para continuar.')
          const items = await quizCollection<Draft>(
            'quizzes',
            token,
            { 'where[owner][equals]': String(user.id) },
            readSignal,
          )
          if (active())
            setDrafts((current) =>
              savedRevision.current === revision
                ? items
                : [
                    ...current,
                    ...items.filter(
                      (item) => !current.some((saved) => saved.id === item.id),
                    ),
                  ],
            )
        })(),
        (async () => {
          const options = await quizCollection<ArticleOption>(
            'articles',
            token,
            { 'select[title]': 'true', 'select[_status]': 'true' },
            readSignal,
          )
          if (!active()) return
          setArticles(options)
          const initialArticle = new URLSearchParams(
            window.location.search,
          ).get('artigo')
          if (
            !articlePrefilled.current &&
            initialArticle &&
            options.some((item) => String(item.id) === initialArticle)
          )
            setArticle(initialArticle)
          articlePrefilled.current = true
        })(),
      ])
      if (!active()) return
      const failures = results.flatMap((result, index) =>
        result.status === 'rejected'
          ? [
              `${index === 0 ? 'Seus quizzes' : 'Artigos'}: ${result.reason instanceof Error ? result.reason.message : 'Não foi possível carregar a lista.'}`,
            ]
          : [],
      )
      setLoadError(failures.join(' '))
      setLoading(false)
    },
    [token],
  )

  useEffect(() => {
    const controller = new AbortController()
    articlePrefilled.current = false
    setReturnPath(window.location.pathname + window.location.search)
    setDrafts([])
    setArticles([])
    setEditing(null)
    setQuiz(emptyQuiz())
    setArticle(new URLSearchParams(window.location.search).get('artigo') || '')
    savedRevision.current = 0
    setNotice('')
    setError('')
    setBusy(false)
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  function updateQuestion(index: number, patch: Partial<QuizQuestion>) {
    setQuiz((current) => ({
      ...current,
      questions: current.questions.map((question, i) =>
        i === index ? { ...question, ...patch } : question,
      ),
    }))
  }

  async function save(status: 'draft' | 'in_review') {
    const validation = validateQuiz(quiz)
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await quizRequest<{ doc: Draft }>(
        editing ? `quizzes/${editing.id}` : 'quizzes',
        token,
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify({
            ...quiz,
            article: article ? Number(article) : null,
            status,
          }),
        },
      )
      if (currentToken.current !== token) return
      savedRevision.current += 1
      setEditing(result.doc)
      setDrafts((current) => [
        result.doc,
        ...current.filter((item) => item.id !== result.doc.id),
      ])
      setNotice(
        status === 'in_review'
          ? 'Quiz enviado para revisão. Ele aparecerá no site depois da publicação.'
          : 'Rascunho salvo. Você pode continuar depois.',
      )
    } catch (cause) {
      if (currentToken.current === token)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Não foi possível salvar o quiz.',
        )
    } finally {
      if (currentToken.current === token) setBusy(false)
    }
  }

  return (
    <>
      <Link
        href="/quizzes/"
        className="text-sm text-[var(--accent)] underline underline-offset-4"
      >
        ← Todos os quizzes
      </Link>
      <header className="mt-12">
        <p className="text-xs uppercase tracking-widest text-[var(--accent)]">
          Contribua com uma descoberta
        </p>
        <h1 className="mt-4 text-4xl tracking-tight">
          Transforme ideias em perguntas.
        </h1>
        <p className="mt-5 text-[var(--muted)]">
          Crie um quiz independente ou relacione-o a um artigo. Salve um
          rascunho, envie para revisão e acompanhe a devolutiva aqui.
        </p>
      </header>
      {!token ? (
        <section className="mt-8 rounded-sm border border-[var(--line)] bg-[var(--surface)] p-6">
          <h2 className="text-xl">Entre para criar seu quiz</h2>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Use a mesma conta do blog e do jogo.
          </p>
          <div className="mt-5 flex gap-4">
            <Link
              href={`/login/?next=${encodeURIComponent(returnPath)}&notice=login-required`}
              className={buttonClass}
            >
              Entrar
            </Link>
            <Link
              href={`/cadastro/?next=${encodeURIComponent(returnPath)}`}
              className={buttonClass}
            >
              Criar conta
            </Link>
          </div>
        </section>
      ) : (
        <>
          {loading && (
            <p className="mt-8 text-sm text-[var(--muted)]" role="status">
              Atualizando suas listas… Você já pode preparar seu quiz.
            </p>
          )}
          {loadError && (
            <div
              role="alert"
              className="mt-6 rounded-sm border border-[var(--secondary)] bg-[var(--secondary-soft)] p-4 text-sm"
            >
              <p>{loadError}</p>
              <button
                type="button"
                disabled={loading}
                onClick={() => void load()}
                className={`${buttonClass} mt-3`}
              >
                Tentar carregar as listas novamente
              </button>
            </div>
          )}
          <form
            ref={formRef}
            onSubmit={(event) => {
              event.preventDefault()
              const submitter = (event.nativeEvent as SubmitEvent).submitter
              void save(
                submitter?.getAttribute('value') === 'in_review'
                  ? 'in_review'
                  : 'draft',
              )
            }}
            className="mt-10 space-y-6"
          >
            <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
                <h2 className="text-2xl">
                  {editing ? 'Editar quiz' : 'Novo quiz'}
                </h2>
                {editing && (
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => {
                      articlePrefilled.current = true
                      setEditing(null)
                      setQuiz(emptyQuiz())
                      setArticle('')
                      setNotice('')
                      setError('')
                    }}
                  >
                    Começar outro quiz
                  </button>
                )}
              </div>
              {editing?.reviewNotes && (
                <aside className="rounded-sm border border-[var(--secondary)] bg-[var(--secondary-soft)] p-4">
                  <h3 className="text-sm">Devolutiva da revisão</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {editing.reviewNotes}
                  </p>
                </aside>
              )}
              <label className="block text-sm">
                Título
                <input
                  required
                  maxLength={160}
                  value={quiz.title}
                  onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm">
                Resumo
                <textarea
                  required
                  rows={3}
                  maxLength={300}
                  value={quiz.summary}
                  onChange={(e) =>
                    setQuiz({ ...quiz, summary: e.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="block text-sm">
                Artigo relacionado (opcional)
                <select
                  value={article}
                  onChange={(e) => {
                    articlePrefilled.current = true
                    setArticle(e.target.value)
                  }}
                  className={inputClass}
                >
                  <option value="">Nenhum — quiz independente</option>
                  {article &&
                    !articles.some((item) => String(item.id) === article) && (
                      <option value={article}>Artigo selecionado</option>
                    )}
                  {articles.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.title}
                      {item._status !== 'published' ? ' (rascunho)' : ''}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-xs text-[var(--muted)]">
                  O vínculo só aparece para visitantes quando o artigo estiver
                  publicado.
                </span>
              </label>
              <div className="space-y-6">
                {quiz.questions.map((question, index) => (
                  <fieldset
                    key={index}
                    className="rounded-sm border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"
                  >
                    <legend className="px-2 text-lg text-[var(--accent)]">
                      Pergunta {index + 1}
                    </legend>
                    <label className="block text-sm">
                      Enunciado
                      <textarea
                        required
                        rows={2}
                        maxLength={1000}
                        value={question.prompt}
                        onChange={(e) =>
                          updateQuestion(index, { prompt: e.target.value })
                        }
                        className={inputClass}
                      />
                    </label>
                    <p className="mt-5 text-sm text-[var(--muted)]">
                      Alternativas — marque a resposta correta.
                    </p>
                    {question.choices.map((choice, choiceIndex) => (
                      <div
                        key={choiceIndex}
                        className="mt-3 flex items-center gap-3"
                      >
                        <input
                          type="radio"
                          name={`correct-${index}`}
                          aria-label={`Alternativa ${choiceIndex + 1} correta na pergunta ${index + 1}`}
                          checked={question.correctAnswer === choiceIndex}
                          onChange={() =>
                            updateQuestion(index, {
                              correctAnswer: choiceIndex,
                            })
                          }
                          className="shrink-0 accent-[var(--accent)]"
                        />
                        <label className="min-w-0 flex-1 text-xs text-[var(--muted)]">
                          Alternativa {choiceIndex + 1}
                          <input
                            required
                            maxLength={300}
                            value={choice.text}
                            onChange={(e) =>
                              updateQuestion(index, {
                                choices: question.choices.map((item, i) =>
                                  i === choiceIndex
                                    ? { ...item, text: e.target.value }
                                    : item,
                                ),
                              })
                            }
                            className={inputClass}
                          />
                        </label>
                        {question.choices.length > 2 && (
                          <button
                            type="button"
                            aria-label={`Remover alternativa ${choiceIndex + 1} da pergunta ${index + 1}`}
                            className={buttonClass}
                            onClick={() =>
                              updateQuestion(index, {
                                choices: question.choices.filter(
                                  (_, i) => i !== choiceIndex,
                                ),
                                correctAnswer:
                                  question.correctAnswer === choiceIndex
                                    ? 0
                                    : question.correctAnswer > choiceIndex
                                      ? question.correctAnswer - 1
                                      : question.correctAnswer,
                              })
                            }
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {question.choices.length < 6 && (
                      <button
                        type="button"
                        className={`${buttonClass} mt-4`}
                        onClick={() =>
                          updateQuestion(index, {
                            choices: [...question.choices, { text: '' }],
                          })
                        }
                      >
                        + Alternativa
                      </button>
                    )}
                    <label className="mt-5 block text-sm">
                      Explicação da resposta
                      <textarea
                        required
                        rows={3}
                        maxLength={2000}
                        value={question.explanation}
                        onChange={(e) =>
                          updateQuestion(index, {
                            explanation: e.target.value,
                          })
                        }
                        className={inputClass}
                      />
                      <span className="mt-1 block text-xs text-[var(--muted)]">
                        Ajude quem respondeu a entender o motivo, mesmo quando
                        errar.
                      </span>
                    </label>
                    {quiz.questions.length > 1 && (
                      <button
                        type="button"
                        className="mt-4 cursor-pointer text-sm text-[var(--secondary)] underline underline-offset-4"
                        onClick={() =>
                          setQuiz({
                            ...quiz,
                            questions: quiz.questions.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                      >
                        Remover pergunta {index + 1}
                      </button>
                    )}
                  </fieldset>
                ))}
              </div>
              {quiz.questions.length < 30 && (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() =>
                    setQuiz({
                      ...quiz,
                      questions: [...quiz.questions, newQuestion()],
                    })
                  }
                >
                  + Adicionar pergunta
                </button>
              )}
              <div className="flex flex-wrap gap-3 border-t border-[var(--line)] pt-6">
                <button type="submit" value="draft" className={buttonClass}>
                  {busy ? 'Salvando…' : 'Salvar rascunho'}
                </button>
                <button
                  type="submit"
                  value="in_review"
                  className="cursor-pointer rounded-sm bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-hover)]"
                >
                  Enviar para revisão
                </button>
              </div>
            </fieldset>
          </form>
          {error && (
            <p
              role="alert"
              className="mt-6 rounded-sm border border-[var(--secondary)] bg-[var(--secondary-soft)] p-4 text-sm"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="mt-6 rounded-sm border border-[var(--accent)] bg-[var(--accent-soft)] p-4 text-sm"
            >
              {notice}
            </p>
          )}
          <section
            className="mt-14 border-t border-[var(--line)] pt-8"
            aria-label="Meus quizzes"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl">Meus quizzes</h2>
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => void load()}
                className={buttonClass}
              >
                Atualizar lista
              </button>
            </div>
            {!loading && !loadError && drafts.length === 0 && (
              <p className="mt-5 text-sm text-[var(--muted)]">
                Seu primeiro quiz começa com uma boa pergunta.
              </p>
            )}
            <ul className="mt-6 space-y-4">
              {drafts.map((draft) => (
                <li
                  key={draft.id}
                  className="rounded-sm border border-[var(--line)] bg-[var(--surface)] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg">{draft.title}</h3>
                    <span className="text-xs text-[var(--accent)]">
                      {QUIZ_STATUS_LABELS[draft.status]}
                    </span>
                  </div>
                  {draft.reviewNotes && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--muted)]">
                      Revisão: {draft.reviewNotes}
                    </p>
                  )}
                  {draft.status !== 'published' ? (
                    <button
                      type="button"
                      disabled={busy}
                      className={`${buttonClass} mt-4`}
                      onClick={() => {
                        articlePrefilled.current = true
                        setEditing(draft)
                        setQuiz({
                          title: draft.title,
                          summary: draft.summary,
                          questions: structuredClone(draft.questions),
                        })
                        setArticle(draft.article ? String(draft.article) : '')
                        setNotice('')
                        setError('')
                        formRef.current?.scrollIntoView({
                          behavior: 'smooth',
                        })
                      }}
                    >
                      Editar quiz
                    </button>
                  ) : (
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      Publicado. Para editar, peça à revisão para despublicar o
                      quiz. A atualização do site acompanha a publicação.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  )
}
