'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorialHeader } from '@/components/blog/editorial-header'
import { GAME_API_URL } from '@/components/game/api/game-api'
import { useGameSession } from '@/components/game/hooks/use-game-session'
import { categoryNames, type ArticleReference } from '@/lib/article-meta'
import { resolveCmsBaseUrl } from '@/lib/cms-client'
import {
  canAuthorEditSubmission,
  extractCmsErrorMessage,
  formatHashtagsInput,
  formatRequestFailure,
  lexicalToPlainText,
  parseHashtagsInput,
  REVIEW_STATUS_LABELS,
  type ReviewStatus,
  slugifyTitle,
  type SubmissionArticle,
  validateSubmissionInput,
} from '@/lib/blog-submission'

const REQUEST_TIMEOUT_MS = 120000

// Flag de compilação (equivalente a #ifdef BLOG_TEST_UI em C):
// Injetada apenas por `make test-blog` (NEXT_PUBLIC_BLOG_TEST_UI=1).
// Em `make dev` normal e `make build` de produção, avalia para `false` e é eliminada pelo bundler.
const BLOG_TEST_UI = process.env.NEXT_PUBLIC_BLOG_TEST_UI === '1'

type CmsUser = {
  id: string | number
  name?: string
  nickname?: string
  email: string
  role?: string
}

type BlogSession = {
  token: string
  user: CmsUser
}

/** Same identity path as /login: game-server validates, JWT works on the CMS APIs. */
async function loginWithSharedSession(
  email: string,
  password: string,
): Promise<BlogSession> {
  const loginResponse = await fetch(`${GAME_API_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const loginData = await loginResponse.json().catch(() => null)
  if (!loginResponse.ok || typeof loginData?.token !== 'string') {
    throw new Error(
      typeof loginData?.error === 'string'
        ? loginData.error
        : extractCmsErrorMessage(loginData, loginResponse.status),
    )
  }
  const meResponse = await fetch(`${resolveCmsBaseUrl() || 'http://localhost:3001'}/api/users/me`, {
    headers: { Authorization: `Bearer ${loginData.token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const meData = await meResponse.json().catch(() => null)
  if (!meResponse.ok || !meData?.user) {
    throw new Error(extractCmsErrorMessage(meData, meResponse.status))
  }
  return { token: loginData.token, user: meData.user as CmsUser }
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  reviewer: 'Revisor',
  author: 'Autor',
  editor: 'Editor',
  member: 'Participante',
}

const SAMPLE_ARTICLE = {
  title: 'Software Livre e Ciência Aberta na Universidade',
  baseSlug: 'software-livre-e-ciencia-aberta',
  summary:
    'Como ferramentas abertas e reprodutíveis fortalecem a pesquisa acadêmica e evitam o aprisionamento tecnológico.',
  category: 'educacao',
  hashtags: ['softwarelivre', 'cienciaaberta', 'educacao'],
  bodyText:
    'A ciência depende da capacidade de inspecionar, reproduzir e auditar resultados. Quando laboratórios utilizam formatos fechados e softwares proprietários, parte do conhecimento fica trancada em caixas-pretas.\n\nAdotar software livre na universidade permite que estudantes compreendam o código por trás dos experimentos e compartilhem melhorias com toda a comunidade.',
  references: [
    {
      label: 'GNU — Software Livre e Educação',
      url: 'https://www.gnu.org/education/education.html',
    },
  ],
}

const QUICK_TEST_ACCOUNTS = [
  {
    label: 'Entrar: Autora 1 (Ana)',
    email: 'autora@gnuverse.local',
    name: 'Ana Autora',
  },
  {
    label: 'Entrar: Autor 2 (Beto)',
    email: 'autor2@gnuverse.local',
    name: 'Beto Autor',
  },
  {
    label: 'Entrar: Revisor (Rui)',
    email: 'revisor@gnuverse.local',
    name: 'Rui Revisor',
  },
] as const

function pickUniqueSampleSlug(docs: SubmissionArticle[]): string {
  const existing = new Set(docs.map((doc) => doc.slug).filter(Boolean))
  if (!existing.has(SAMPLE_ARTICLE.baseSlug)) {
    return SAMPLE_ARTICLE.baseSlug
  }
  let counter = 2
  while (existing.has(`${SAMPLE_ARTICLE.baseSlug}-${counter}`)) {
    counter += 1
  }
  return `${SAMPLE_ARTICLE.baseSlug}-${counter}`
}

function reviewBadgeClass(status?: ReviewStatus): string {
  switch (status) {
    case 'approved':
      return 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
    case 'changes_requested':
      return 'border-[var(--secondary)] bg-[var(--secondary-soft)] text-[var(--secondary)]'
    case 'in_review':
      return 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink)]'
    default:
      return 'border-[var(--line)] bg-[var(--background)] text-[var(--muted)]'
  }
}

function formatUpdatedAt(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function SubmissionPanel({
  mode = 'live',
}: {
  mode?: 'demo' | 'live'
}) {
  const { token, setSessionToken, logout, user: gameUser } = useGameSession()
  const [cmsUrl, setCmsUrl] = useState<string | null | undefined>(undefined)
  const [isOpen, setIsOpen] = useState(false)
  const [session, setSession] = useState<BlogSession | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')

  // Formulário de artigo
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [summary, setSummary] = useState('')
  const [author, setAuthor] = useState('')
  const [category, setCategory] = useState('reflexoes')
  const [hashtagsInput, setHashtagsInput] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [references, setReferences] = useState<ArticleReference[]>([])
  const [submitBusy, setSubmitBusy] = useState(false)
  const [submitSlowHint, setSubmitSlowHint] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')

  // Lista de submissões do usuário
  const [myArticles, setMyArticles] = useState<SubmissionArticle[]>([])
  const [listBusy, setListBusy] = useState(false)
  const [listError, setListError] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const autotestInitializedRef = useRef(false)

  const applySampleDraft = useCallback(
    (defaultAuthor: string, docs: SubmissionArticle[]) => {
      setEditingId(null)
      setTitle(SAMPLE_ARTICLE.title)
      setSlug(pickUniqueSampleSlug(docs))
      setSlugTouched(false)
      setSummary(SAMPLE_ARTICLE.summary)
      setAuthor((current) => defaultAuthor || current || 'Ana Autora')
      setCategory(SAMPLE_ARTICLE.category)
      setHashtagsInput(formatHashtagsInput(SAMPLE_ARTICLE.hashtags))
      setBodyText(SAMPLE_ARTICLE.bodyText)
      setReferences(SAMPLE_ARTICLE.references.map((item) => ({ ...item })))
      setSubmitError('')
    },
    [],
  )

  const resetForm = useCallback(
    (defaultAuthor: string) => {
      setEditingId(null)
      setTitle('')
      setSlug('')
      setSlugTouched(false)
      setSummary('')
      setAuthor(defaultAuthor)
      setCategory('reflexoes')
      setHashtagsInput('')
      setBodyText('')
      setReferences([])
    },
    [],
  )

  const handleSessionExpired = useCallback(() => {
    setSessionToken('')
    setSession(null)
    setMyArticles([])
    setAuthError('Sua sessão expirou. Entre novamente em /login para continuar.')
  }, [setSessionToken])

  const loadMyArticles = useCallback(
    async (activeSession: BlogSession): Promise<SubmissionArticle[]> => {
      if (!cmsUrl) return []
      setListBusy(true)
      setListError('')
      try {
        const params = new URLSearchParams({
          'where[owner][equals]': String(activeSession.user.id),
          draft: 'true',
          sort: '-updatedAt',
          limit: '50',
        })
        const response = await fetch(`${cmsUrl}/api/articles?${params}`, {
          headers: { Authorization: `Bearer ${activeSession.token}` },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          if (response.status === 401) {
            handleSessionExpired()
            return []
          }
          throw new Error(extractCmsErrorMessage(data, response.status))
        }
        const docs: SubmissionArticle[] = Array.isArray(data?.docs)
          ? data.docs
          : []
        setMyArticles(docs)
        if (BLOG_TEST_UI) {
          setSlug((currentSlug) => {
            if (
              currentSlug === SAMPLE_ARTICLE.baseSlug &&
              docs.some((doc) => doc.slug === SAMPLE_ARTICLE.baseSlug)
            ) {
              return pickUniqueSampleSlug(docs)
            }
            return currentSlug
          })
        }
        return docs
      } catch (cause) {
        setListError(formatRequestFailure(cause))
        return []
      } finally {
        setListBusy(false)
      }
    },
    [cmsUrl, handleSessionExpired],
  )

  useEffect(() => {
    setCmsUrl(resolveCmsBaseUrl())
  }, [])

  useEffect(() => {
    if (!token || !cmsUrl) {
      if (!token) {
        setSession(null)
        setMyArticles([])
      }
      return
    }
    let active = true
    void (async () => {
      try {
        const response = await fetch(`${cmsUrl}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        const data = await response.json().catch(() => null)
        if (!active) return
        if (!response.ok || !data?.user) {
          if (response.status === 401 || response.ok) {
            handleSessionExpired()
          }
          return
        }
        const cmsUser = data.user as CmsUser
        setSession({ token, user: cmsUser })
        setAuthor(
          (current) => current || cmsUser.name || cmsUser.nickname || '',
        )
        setAuthError('')
      } catch {
        /* Mantém estado atual caso o CMS esteja temporariamente indisponível. */
      }
    })()
    return () => {
      active = false
    }
  }, [cmsUrl, token, handleSessionExpired])

  useEffect(() => {
    if (!BLOG_TEST_UI || autotestInitializedRef.current) return

    const params = new URLSearchParams(window.location.search)
    const isAutotest = params.get('autotest') === '1'
    if (!isAutotest) return

    autotestInitializedRef.current = true
    setIsOpen(true)
    applySampleDraft(gameUser?.nickname || 'Ana Autora', [])

    if (!token) {
      void (async () => {
        try {
          const nextSession = await loginWithSharedSession(
            'autora@gnuverse.local',
            'gnuverse123',
          )
          setSessionToken(nextSession.token)
          setSession(nextSession)
          setAuthor(nextSession.user.name || nextSession.user.nickname || 'Ana Autora')
        } catch {
          /* Silencioso caso a conta de demonstração ainda não exista no banco local. */
        }
      })()
    }

    const scrollTimer = setTimeout(() => {
      sectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 150)
    return () => clearTimeout(scrollTimer)
  }, [applySampleDraft, gameUser?.nickname, setSessionToken, token])

  useEffect(() => {
    if (isOpen && session) {
      void loadMyArticles(session)
    }
  }, [isOpen, session, loadMyArticles])

  async function handleQuickLogin(email: string, defaultName: string) {
    setAuthError('')
    setSubmitError('')
    setSubmitSuccess('')
    setAuthBusy(true)
    try {
      const nextSession = await loginWithSharedSession(email, 'gnuverse123')
      setSessionToken(nextSession.token)
      setSession(nextSession)
      setAuthor(nextSession.user.name || nextSession.user.nickname || defaultName)
      await loadMyArticles(nextSession)
    } catch (cause) {
      setAuthError(formatRequestFailure(cause))
    } finally {
      setAuthBusy(false)
    }
  }

  function handleFillSampleArticle() {
    applySampleDraft(session?.user.name || author || 'Ana Autora', myArticles)
    setSubmitSuccess(
      'Artigo de exemplo preenchido! Clique em "Enviar para revisão" ou "Salvar rascunho" com 1 clique.',
    )
  }

  async function handleLogout() {
    const activeToken = session?.token || token
    let loggedOutViaGameServer = false
    try {
      await logout()
      loggedOutViaGameServer = true
    } catch {
      setSessionToken('')
    }
    if (!loggedOutViaGameServer && activeToken && cmsUrl) {
      try {
        await fetch(`${cmsUrl}/api/users/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${activeToken}` },
          signal: AbortSignal.timeout(10000),
        })
      } catch {
        /* Encerramento local da sessão continua garantido. */
      }
    }
    setSession(null)
    setMyArticles([])
    setSubmitError('')
    setSubmitSuccess('')
    resetForm('')
  }

  function handleTitleChange(nextTitle: string) {
    setTitle(nextTitle)
    if (!editingId && !slugTouched) {
      setSlug(slugifyTitle(nextTitle))
    }
  }

  function handleAddReference() {
    setReferences((current) => [...current, { label: '', url: '' }])
  }

  function handleReferenceChange(
    index: number,
    field: 'label' | 'url',
    value: string,
  ) {
    setReferences((current) =>
      current.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )
  }

  function handleRemoveReference(index: number) {
    setReferences((current) => current.filter((_, i) => i !== index))
  }

  function handleStartEdit(doc: SubmissionArticle) {
    setEditingId(String(doc.id))
    setTitle(doc.title || '')
    setSlug(doc.slug || '')
    setSlugTouched(true)
    setSummary(doc.summary || '')
    setAuthor(doc.author || session?.user.name || '')
    setCategory(
      doc.category && Object.hasOwn(categoryNames, doc.category)
        ? doc.category
        : 'reflexoes',
    )
    setHashtagsInput(formatHashtagsInput(doc.hashtags))
    setBodyText(lexicalToPlainText(doc.body))
    setReferences(
      Array.isArray(doc.references)
        ? doc.references.map((ref) => ({
            label: ref.label || '',
            url: ref.url || '',
          }))
        : [],
    )
    setSubmitError('')
    setSubmitSuccess(
      `Editando "${doc.title}". Ao finalizar, salve o rascunho ou envie novamente para revisão.`,
    )
    titleInputRef.current?.focus()
  }

  async function handleSaveSubmission(targetReviewStatus: 'draft' | 'in_review') {
    if (!session || !cmsUrl) return
    setSubmitError('')
    setSubmitSuccess('')

    const parsedHashtags = parseHashtagsInput(hashtagsInput)
    const validated = validateSubmissionInput({
      title,
      slug,
      summary,
      author,
      category,
      hashtags: parsedHashtags,
      bodyText,
      references,
    })
    if (!validated.ok) {
      setSubmitError(validated.error)
      return
    }

    setSubmitBusy(true)
    setSubmitSlowHint(false)
    const slowTimer = setTimeout(() => setSubmitSlowHint(true), 4000)

    try {
      const endpoint = editingId
        ? `${cmsUrl}/api/articles/${encodeURIComponent(editingId)}?draft=true`
        : `${cmsUrl}/api/articles?draft=true`
      const method = editingId ? 'PATCH' : 'POST'
      const { hashtags, ...submissionPayload } = validated.data

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          ...submissionPayload,
          hashtags: hashtags.map((tag) => ({ tag })),
          reviewStatus: targetReviewStatus,
          _status: 'draft',
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        if (response.status === 401) {
          handleSessionExpired()
          return
        }
        throw new Error(extractCmsErrorMessage(data, response.status))
      }

      const savedDoc = (data?.doc ?? data) as SubmissionArticle | null
      if (targetReviewStatus === 'in_review') {
        resetForm(session.user.name || '')
        setSubmitSuccess(
          'Artigo enviado para revisão editorial. Acompanhe o andamento abaixo.',
        )
      } else {
        if (savedDoc?.id !== undefined) {
          setEditingId(String(savedDoc.id))
          setSlugTouched(true)
        }
        setSubmitSuccess(
          'Rascunho salvo no CMS. Você pode continuar editando ou enviar para revisão.',
        )
      }

      await loadMyArticles(session)
    } catch (cause) {
      setSubmitError(formatRequestFailure(cause))
    } finally {
      clearTimeout(slowTimer)
      setSubmitSlowHint(false)
      setSubmitBusy(false)
    }
  }

  const previewHashtags = parseHashtagsInput(hashtagsInput)

  const inputClass =
    'mt-1.5 w-full rounded-sm border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none'

  return (
    <section ref={sectionRef} aria-label="Submissão editorial">
      <EditorialHeader
        mode={mode}
        action={
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls="editorial-submission-body"
            onClick={() => setIsOpen((open) => !open)}
            className="cursor-pointer rounded-sm border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {isOpen ? 'Fechar submissão' : 'Contribuir com um artigo'}
          </button>
        }
      />

      {isOpen && (
        <div
          id="editorial-submission-body"
          className="mt-8 rounded-sm border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8"
        >
          {BLOG_TEST_UI && (
            <div className="mb-5 rounded-sm border border-[var(--accent)] bg-[var(--accent-soft)] p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold uppercase tracking-wider text-[var(--accent)]">
                  Atalhos de Teste Rápido (Ambiente Local)
                </p>
                <span className="text-[var(--muted)]">
                  Painel CMS: <code>admin@gnuverse.local</code> /{' '}
                  <code>revisor@gnuverse.local</code> · senha{' '}
                  <code>gnuverse123</code>
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {QUICK_TEST_ACCOUNTS.map((account) => {
                  const isActive = session?.user.email === account.email
                  return (
                    <button
                      key={account.email}
                      type="button"
                      disabled={authBusy}
                      onClick={() =>
                        void handleQuickLogin(account.email, account.name)
                      }
                      className={`cursor-pointer rounded-sm border px-2.5 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        isActive
                          ? 'border-[var(--accent)] bg-[var(--accent)] font-medium text-[var(--on-accent)]'
                          : 'border-[var(--line)] bg-[var(--background)] text-[var(--ink)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {account.label}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={handleFillSampleArticle}
                  className="cursor-pointer rounded-sm border border-[var(--line)] bg-[var(--background)] px-2.5 py-1.5 text-xs text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  Preencher artigo exemplo
                </button>
                <a
                  href={`${cmsUrl || 'http://localhost:3001'}/admin`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm border border-[var(--line)] bg-[var(--background)] px-2.5 py-1.5 text-xs text-[var(--accent)] transition hover:border-[var(--accent)]"
                >
                  Abrir /admin (CMS) ↗
                </a>
              </div>
            </div>
          )}

          <p className="rounded-sm border border-[var(--line)] bg-[var(--surface-raised)] p-3.5 text-xs leading-relaxed text-[var(--muted)]">
            Os textos enviados entram como rascunho ou revisão editorial e só
            vão ao ar após aprovação de um revisor. No plano gratuito do
            Render, o servidor do CMS pode levar até cerca de 1 minuto para
            despertar na primeira ação — a leitura dos artigos publicados
            continua instantânea.
          </p>

          {cmsUrl === null ? (
            <div className="mt-6 rounded-sm border border-[var(--line)] bg-[var(--background)] p-5">
              <p className="text-sm leading-relaxed text-[var(--ink)]">
                O servidor editorial (CMS) ainda não foi configurado neste
                ambiente público (<code>NEXT_PUBLIC_CMS_URL</code> ausente). A
                leitura dos artigos publicados funciona normalmente; para enviar
                textos, configure o CMS em produção ou use o ambiente local.
              </p>
            </div>
          ) : !session ? (
            <div className="mt-6 rounded-sm border border-[var(--line)] bg-[var(--background)] p-5">
              <p className="text-sm leading-relaxed text-[var(--ink)]">
                Para enviar artigos para revisão editorial e acompanhar suas
                submissões, entre na sua conta em <code>/login</code> ou crie um
                cadastro em <code>/cadastro</code>.
              </p>
              {authError && (
                <p
                  role="alert"
                  className="mt-3 rounded-sm border border-[var(--secondary)] bg-[var(--secondary-soft)] p-3 text-sm text-[var(--ink)]"
                >
                  {authError}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href="/login/?next=/blog/"
                  className="rounded-sm border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)]"
                >
                  Entrar em /login
                </Link>
                <Link
                  href="/cadastro/?next=/blog/"
                  className="rounded-sm border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  Criar conta em /cadastro
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-10">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
                <div>
                  <p className="text-sm font-medium text-[var(--ink)]">
                    {session.user.name || session.user.email}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {session.user.email}
                    {session.user.role
                      ? ` · ${ROLE_LABELS[session.user.role] ?? session.user.role}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="cursor-pointer rounded-sm border border-[var(--line)] bg-[var(--background)] px-3.5 py-2 text-xs text-[var(--muted)] transition hover:border-[var(--secondary)] hover:text-[var(--secondary)]"
                >
                  Sair
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleSaveSubmission('draft')
                }}
                className="space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xl tracking-tight">
                    {editingId ? 'Editar rascunho' : 'Novo artigo para revisão'}
                  </h3>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        resetForm(session.user.name || '')
                        setSubmitError('')
                        setSubmitSuccess('')
                      }}
                      className="cursor-pointer text-xs text-[var(--accent)] underline underline-offset-4"
                    >
                      Começar novo artigo
                    </button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-[var(--ink)]">
                    Título
                    <input
                      ref={titleInputRef}
                      type="text"
                      required
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="Ex.: Software livre na universidade pública"
                      className={inputClass}
                    />
                  </label>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="submission-slug"
                        className="text-sm text-[var(--ink)]"
                      >
                        Endereço (slug)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSlug(slugifyTitle(title))
                          setSlugTouched(false)
                        }}
                        className="cursor-pointer text-xs text-[var(--accent)] underline underline-offset-4"
                      >
                        Gerar do título
                      </button>
                    </div>
                    <input
                      id="submission-slug"
                      type="text"
                      required
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value)
                        setSlugTouched(true)
                      }}
                      placeholder="software-livre-na-universidade"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-[var(--ink)]">
                    Autoria exibida no artigo
                    <input
                      type="text"
                      required
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="Seu nome ou coletivo"
                      className={inputClass}
                    />
                  </label>

                  <label className="block text-sm text-[var(--ink)]">
                    Categoria
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={inputClass}
                    >
                      {Object.entries(categoryNames).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="submission-summary"
                      className="text-sm text-[var(--ink)]"
                    >
                      Resumo
                    </label>
                    <span className="text-xs tabular-nums text-[var(--muted)]">
                      {summary.length}/300
                    </span>
                  </div>
                  <textarea
                    id="submission-summary"
                    required
                    rows={3}
                    maxLength={300}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Síntese curta apresentada no card e no topo do artigo."
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="submission-hashtags"
                    className="block text-sm text-[var(--ink)]"
                  >
                    Hashtags (opcional)
                  </label>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Separe por vírgula ou espaço (máximo de 10). Ex.:{' '}
                    <code>#softwarelivre, #educacao, #gnu</code>
                  </p>
                  <input
                    id="submission-hashtags"
                    type="text"
                    value={hashtagsInput}
                    onChange={(e) => setHashtagsInput(e.target.value)}
                    placeholder="#softwarelivre, #educacao, #cienciaaberta"
                    className={inputClass}
                  />
                  {previewHashtags.length > 0 && (
                    <ul
                      aria-label="Pré-visualização das hashtags"
                      className="mt-2 flex flex-wrap gap-1.5"
                    >
                      {previewHashtags.map((tag) => (
                        <li
                          key={tag}
                          className="rounded-sm border border-[var(--line)] bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--accent)]"
                        >
                          #{tag}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="submission-body"
                    className="block text-sm text-[var(--ink)]"
                  >
                    Texto do artigo
                  </label>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Separe os parágrafos com uma linha em branco. Formatação
                    avançada ou capa opcional podem ser ajustadas na revisão
                    pelo painel administrativo.
                  </p>
                  <textarea
                    id="submission-body"
                    required
                    rows={9}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder={
                      'Primeiro parágrafo do artigo...\n\nSegundo parágrafo com argumentos e exemplos...'
                    }
                    className={inputClass}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-[var(--ink)]">
                      Referências (opcional)
                    </span>
                    <button
                      type="button"
                      onClick={handleAddReference}
                      className="cursor-pointer rounded-sm border border-[var(--line)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--accent)] transition hover:border-[var(--accent)]"
                    >
                      + Adicionar referência
                    </button>
                  </div>
                  {references.map((reference, index) => (
                    <div
                      key={index}
                      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                    >
                      <label className="block text-xs text-[var(--muted)]">
                        Título da fonte
                        <input
                          type="text"
                          value={reference.label}
                          onChange={(e) =>
                            handleReferenceChange(index, 'label', e.target.value)
                          }
                          placeholder="Ex.: Licença GPLv3 — GNU"
                          className={inputClass}
                        />
                      </label>
                      <label className="block text-xs text-[var(--muted)]">
                        Link (HTTP ou HTTPS)
                        <input
                          type="url"
                          value={reference.url}
                          onChange={(e) =>
                            handleReferenceChange(index, 'url', e.target.value)
                          }
                          placeholder="https://www.gnu.org/licenses/gpl-3.0.html"
                          className={inputClass}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveReference(index)}
                        className="cursor-pointer rounded-sm border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)] transition hover:border-[var(--secondary)] hover:text-[var(--secondary)]"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>

                {submitError && (
                  <p
                    role="alert"
                    className="rounded-sm border border-[var(--secondary)] bg-[var(--secondary-soft)] p-3 text-sm text-[var(--ink)]"
                  >
                    {submitError}
                  </p>
                )}

                {submitSuccess && (
                  <p
                    role="status"
                    className="rounded-sm border border-[var(--accent)] bg-[var(--accent-soft)] p-3 text-sm text-[var(--ink)]"
                  >
                    {submitSuccess}
                  </p>
                )}

                {submitSlowHint && (
                  <p className="text-xs text-[var(--accent)]">
                    Enviando ao CMS… Se o servidor no Render Free estiver
                    despertando, a resposta pode levar até ~1 minuto.
                  </p>
                )}

                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={submitBusy}
                    className="cursor-pointer rounded-sm border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm text-[var(--ink)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitBusy ? 'Enviando…' : 'Salvar rascunho'}
                  </button>
                  <button
                    type="button"
                    disabled={submitBusy}
                    onClick={() => void handleSaveSubmission('in_review')}
                    className="cursor-pointer rounded-sm border border-[var(--accent)] bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitBusy ? 'Enviando…' : 'Enviar para revisão'}
                  </button>
                </div>
              </form>

              <div className="border-t border-[var(--line)] pt-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xl tracking-tight">Minhas submissões</h3>
                  <Link href="/quizzes/criar/" className="text-sm text-[var(--accent)] underline underline-offset-4">Criar quiz independente</Link>
                  <button
                    type="button"
                    disabled={listBusy}
                    onClick={() => void loadMyArticles(session)}
                    className="cursor-pointer rounded-sm border border-[var(--line)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--accent)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {listBusy ? 'Atualizando…' : 'Atualizar lista'}
                  </button>
                </div>

                {listError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-sm border border-[var(--secondary)] bg-[var(--secondary-soft)] p-3 text-sm text-[var(--ink)]"
                  >
                    {listError}
                  </p>
                )}

                {!listBusy && !listError && myArticles.length === 0 && (
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    Você ainda não salvou ou enviou artigos com esta conta.
                  </p>
                )}

                {myArticles.length > 0 && (
                  <ul className="mt-5 space-y-4">
                    {myArticles.map((doc) => {
                      const reviewLabel =
                        (doc.reviewStatus &&
                          REVIEW_STATUS_LABELS[doc.reviewStatus]) ||
                        'Rascunho'
                      const isPublished = doc._status === 'published'
                      const editable = canAuthorEditSubmission(doc)
                      const updatedText = formatUpdatedAt(doc.updatedAt)

                      return (
                        <li
                          key={String(doc.id)}
                          className="rounded-sm border border-[var(--line)] bg-[var(--background)] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-medium text-[var(--ink)]">
                                {doc.title}
                              </p>
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                {categoryNames[doc.category] ?? doc.category} ·{' '}
                                <code>/artigos/{doc.slug}/</code>
                                {updatedText
                                  ? ` · Atualizado em ${updatedText}`
                                  : ''}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-sm border px-2.5 py-1 text-xs ${reviewBadgeClass(doc.reviewStatus)}`}
                              >
                                {reviewLabel}
                              </span>
                              <span
                                className={`rounded-sm border px-2.5 py-1 text-xs ${
                                  isPublished
                                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                                }`}
                              >
                                {isPublished ? 'Publicado' : 'Não publicado'}
                              </span>
                            </div>
                          </div>

                          {doc.reviewNotes && doc.reviewNotes.trim() && (
                            <div className="mt-3 rounded-sm border border-[var(--secondary)] bg-[var(--secondary-soft)] p-3 text-sm">
                              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--secondary)]">
                                Devolutiva da revisão
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-[var(--ink)]">
                                {doc.reviewNotes}
                              </p>
                            </div>
                          )}

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <Link href={`/quizzes/criar/?artigo=${doc.id}`} className="text-xs text-[var(--accent)] underline underline-offset-4">Criar quiz relacionado</Link>
                            {editable && (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(doc)}
                                className="cursor-pointer rounded-sm border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--accent)] transition hover:border-[var(--accent)]"
                              >
                                Editar
                              </button>
                            )}
                            {isPublished && (
                              <Link
                                href={`/artigos/${doc.slug}/`}
                                className="text-xs text-[var(--accent)] underline underline-offset-4"
                              >
                                Ver artigo publicado ↗
                              </Link>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
