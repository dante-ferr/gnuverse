'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useGameSession } from '@/components/game/hooks/use-game-session'
import {
  COMMENT_MAX_LENGTH,
  createArticleComment,
  deleteArticleComment,
  fetchArticleInteractions,
  toggleArticleLike,
  type ArticleComment,
} from '@/lib/blog-interactions-client'

type Props = {
  slug: string
  mode: 'demo' | 'live'
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'GN'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function formatCommentDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 13.7s-5.3-3.4-5.3-7.2A3.1 3.1 0 0 1 8 4.4a3.1 3.1 0 0 1 5.3 2.1c0 3.8-5.3 7.2-5.3 7.2Z" />
    </svg>
  )
}

export function ArticleInteractions({ slug, mode }: Props) {
  const session = useGameSession()
  const [likesCount, setLikesCount] = useState(0)
  const [likedByMe, setLikedByMe] = useState(false)
  const [comments, setComments] = useState<ArticleComment[]>([])
  const [loading, setLoading] = useState(mode === 'live')
  const [unavailable, setUnavailable] = useState(mode === 'demo')
  const [likeBusy, setLikeBusy] = useState(false)
  const [likePrompt, setLikePrompt] = useState(false)
  const [draft, setDraft] = useState('')
  const [submitBusy, setSubmitBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loginHref = `/login/?next=${encodeURIComponent(`/artigos/${slug}/`)}`

  useEffect(() => {
    if (mode === 'demo') {
      setUnavailable(true)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setUnavailable(false)
    setError('')
    void fetchArticleInteractions(slug, session.token || undefined)
      .then((data) => {
        if (!active) return
        setLikesCount(data.likesCount)
        setLikedByMe(data.likedByMe)
        setComments(data.comments)
      })
      .catch(() => {
        if (!active) return
        setUnavailable(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [slug, mode, session.token])

  async function handleLike() {
    if (!session.token) {
      setLikePrompt(true)
      return
    }
    setLikePrompt(false)
    setLikeBusy(true)
    setError('')
    try {
      const updated = await toggleArticleLike(slug, session.token)
      setLikesCount(updated.likesCount)
      setLikedByMe(updated.likedByMe)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível registrar sua curtida.',
      )
    } finally {
      setLikeBusy(false)
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session.token) return
    const trimmed = draft.trim()
    if (trimmed.length < 3) {
      setError('O comentário deve ter pelo menos 3 caracteres.')
      return
    }
    setSubmitBusy(true)
    setError('')
    try {
      const created = await createArticleComment(slug, session.token, trimmed)
      setComments((current) => [created, ...current])
      setDraft('')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível publicar seu comentário.',
      )
    } finally {
      setSubmitBusy(false)
    }
  }

  async function handleDelete(commentId: string) {
    if (!session.token) return
    setDeletingId(commentId)
    setError('')
    try {
      await deleteArticleComment(slug, session.token, commentId)
      setComments((current) => current.filter((item) => item.id !== commentId))
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível apagar o comentário.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section
      aria-labelledby="article-interactions-heading"
      className="mt-12 border-t border-[var(--line)] pt-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            id="article-interactions-heading"
            className="text-2xl font-semibold tracking-tight text-[var(--ink)]"
          >
            Conversa e curtidas
          </h2>
          {!unavailable && !loading && (
            <p className="mt-1 font-mono text-xs tabular-nums text-[var(--muted)]">
              {comments.length}{' '}
              {comments.length === 1 ? 'comentário' : 'comentários'}
            </p>
          )}
        </div>

        {!unavailable && (
          <button
            type="button"
            disabled={likeBusy || loading}
            aria-pressed={likedByMe}
            onClick={() => void handleLike()}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              likedByMe
                ? 'border-[var(--secondary)] bg-[var(--secondary-soft)] text-[var(--secondary)]'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--muted)] hover:bg-[var(--surface-raised)]'
            }`}
          >
            <HeartIcon filled={likedByMe} />
            <span>{likedByMe ? 'Curtido' : 'Curtir'}</span>
            <span className="font-mono text-xs tabular-nums">{likesCount}</span>
          </button>
        )}
      </div>

      {unavailable ? (
        <p className="mt-5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
          Comentários e curtidas estão indisponíveis no modo demonstração ou
          quando o servidor editorial (CMS) está offline.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {likePrompt && !session.token && (
            <p
              role="status"
              className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]"
            >
              <Link
                href={loginHref}
                className="font-medium text-[var(--accent)] underline underline-offset-4"
              >
                Entre na sua conta
              </Link>{' '}
              para curtir este artigo.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-md border border-[var(--secondary)] bg-[var(--secondary-soft)] px-4 py-3 text-sm text-[var(--secondary)]"
            >
              {error}
            </p>
          )}

          {session.token ? (
            <form
              onSubmit={(event) => void handleCommentSubmit(event)}
              className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-5"
            >
              <label
                htmlFor="article-comment-input"
                className="block text-sm font-medium text-[var(--ink)]"
              >
                Deixe um comentário
              </label>
              <textarea
                id="article-comment-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={COMMENT_MAX_LENGTH}
                rows={3}
                placeholder="Compartilhe sua leitura, dúvida ou complemento sobre o texto…"
                className="mt-2.5 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 text-sm leading-relaxed text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-xs tabular-nums text-[var(--muted)]">
                  {draft.length}/{COMMENT_MAX_LENGTH}
                </span>
                <button
                  type="submit"
                  disabled={submitBusy || draft.trim().length < 3}
                  className="cursor-pointer rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)] transition hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitBusy ? 'Publicando…' : 'Publicar comentário'}
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
              <p>
                Quer participar da conversa?{' '}
                <Link
                  href={loginHref}
                  className="font-medium text-[var(--accent)] underline underline-offset-4"
                >
                  Entre na sua conta
                </Link>{' '}
                para comentar neste artigo.
              </p>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-[var(--muted)]">
              Carregando comentários…
            </p>
          ) : comments.length > 0 ? (
            <ul className="space-y-4">
              {comments.map((comment) => {
                const formatted = formatCommentDate(comment.createdAt)
                return (
                  <li
                    key={comment.id}
                    className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="aspect-square h-9 w-9 shrink-0 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface-raised)]">
                          {comment.author.avatar ? (
                            <img
                              src={comment.author.avatar.url}
                              alt={comment.author.avatar.alt}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div
                              aria-hidden="true"
                              className="flex h-full w-full items-center justify-center font-mono text-xs font-medium text-[var(--accent)]"
                            >
                              {getInitials(comment.author.name)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--ink)]">
                            {comment.author.name}
                          </p>
                          {formatted && (
                            <time
                              dateTime={comment.createdAt}
                              className="block font-mono text-[11px] tabular-nums text-[var(--muted)]"
                            >
                              {formatted}
                            </time>
                          )}
                        </div>
                      </div>

                      {comment.canDelete && (
                        <button
                          type="button"
                          disabled={deletingId === comment.id}
                          onClick={() => void handleDelete(comment.id)}
                          className="shrink-0 cursor-pointer rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--secondary)] hover:text-[var(--secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === comment.id ? 'Apagando…' : 'Apagar'}
                        </button>
                      )}
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]">
                      {comment.content}
                    </p>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-md border border-dashed border-[var(--line)] bg-[var(--surface)] px-5 py-8 text-center text-sm text-[var(--muted)]">
              Ainda não há comentários neste artigo. Seja a primeira pessoa a
              comentar.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
