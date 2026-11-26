'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { EditorialHeader } from '@/components/blog/editorial-header'
import { GAME_API_URL } from '@/components/game/api/game-api'
import { useGameSession } from '@/components/game/hooks/use-game-session'
import type { ArticleReference } from '@/lib/article-meta'
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
  type SubmissionMedia,
  validateSubmissionInput,
} from '@/lib/blog-submission'

const REQUEST_TIMEOUT_MS = 120000
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
  const meResponse = await fetch(
    `${resolveCmsBaseUrl() || 'http://localhost:3001'}/api/users/me`,
    {
      headers: { Authorization: `Bearer ${loginData.token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  )
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
  { label: 'Entrar: Autora 1 (Ana)', email: 'autora@gnuverse.local' },
  { label: 'Entrar: Autor 2 (Beto)', email: 'autor2@gnuverse.local' },
  { label: 'Entrar: Revisor (Rui)', email: 'revisor@gnuverse.local' },
] as const

function pickUniqueSampleSlug(docs: SubmissionArticle[]): string {
  const existing = new Set(docs.map((doc) => doc.slug).filter(Boolean))
  if (!existing.has(SAMPLE_ARTICLE.baseSlug)) return SAMPLE_ARTICLE.baseSlug
  let counter = 2
  while (existing.has(`${SAMPLE_ARTICLE.baseSlug}-${counter}`)) counter += 1
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

function resolveAuthorName(user: CmsUser): string {
  return (user.name || user.nickname || user.email || '').trim()
}

function resolveMediaUrl(cmsUrl: string, rawUrl?: string): string {
  if (!rawUrl) return ''
  try {
    return new URL(rawUrl, cmsUrl).href
  } catch {
    return rawUrl
  }
}

async function uploadMediaFile(
  cmsUrl: string,
  token: string,
  file: File,
  alt: string,
  credit: string,
): Promise<SubmissionMedia> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('_payload', JSON.stringify({ alt, credit }))

  const response = await fetch(`${cmsUrl}/api/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(extractCmsErrorMessage(data, response.status))
  }
  const doc = (data?.doc ?? data) as SubmissionMedia | undefined
  if (!doc || doc.id === undefined) {
    throw new Error('Não foi possível concluir o envio da imagem.')
  }
  return doc
}

export function SubmissionPanel({
  mode = 'live',
  standalone = false,
}: {
  mode?: 'demo' | 'live'
  standalone?: boolean
}) {
  const { token, setSessionToken, logout } = useGameSession()
  const [cmsUrl, setCmsUrl] = useState<string | null | undefined>(undefined)
  const [isOpen, setIsOpen] = useState(standalone)
  const [session, setSession] = useState<BlogSession | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')

  // Formulário de artigo
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [summary, setSummary] = useState('')
  const [hashtagsInput, setHashtagsInput] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [references, setReferences] = useState<ArticleReference[]>([])

  // Imagem de capa
  const [coverMedia, setCoverMedia] = useState<SubmissionMedia | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('')
  const [coverAlt, setCoverAlt] = useState('')
  const [coverCredit, setCoverCredit] = useState('')
  const [coverRemoved, setCoverRemoved] = useState(false)

  // Upload de imagem no corpo
  const [inlineImageBusy, setInlineImageBusy] = useState(false)

  const [submitBusy, setSubmitBusy] = useState(false)
  const [submitSlowHint, setSubmitSlowHint] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')

  // Lista de submissões do usuário
  const [myArticles, setMyArticles] = useState<SubmissionArticle[]>([])
  const [listBusy, setListBusy] = useState(false)
  const [listError, setListError] = useState('')

  const titleInputRef = useRef<HTMLInputElement>(null)
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null)
  const inlineFileInputRef = useRef<HTMLInputElement>(null)
  const coverFileInputRef = useRef<HTMLInputElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const autotestInitializedRef = useRef(false)
  const initialEditLoadedRef = useRef(false)

  const applySampleDraft = useCallback((docs: SubmissionArticle[]) => {
    setEditingId(null)
    setTitle(SAMPLE_ARTICLE.title)
    setSlug(pickUniqueSampleSlug(docs))
    setSlugTouched(false)
    setSummary(SAMPLE_ARTICLE.summary)
    setHashtagsInput(formatHashtagsInput(SAMPLE_ARTICLE.hashtags))
    setBodyText(SAMPLE_ARTICLE.bodyText)
    setReferences(SAMPLE_ARTICLE.references.map((item) => ({ ...item })))
    setSubmitError('')
  }, [])

  const clearCoverSelection = useCallback(() => {
    setCoverMedia(null)
    setCoverFile(null)
    setCoverPreviewUrl('')
    setCoverAlt('')
    setCoverCredit('')
    setCoverRemoved(false)
    if (coverFileInputRef.current) coverFileInputRef.current.value = ''
  }, [])

  const resetForm = useCallback(() => {
    setEditingId(null)
    setTitle('')
    setSlug('')
    setSlugTouched(false)
    setSummary('')
    setHashtagsInput('')
    setBodyText('')
    setReferences([])
    clearCoverSelection()
  }, [clearCoverSelection])

  const handleSessionExpired = useCallback(() => {
    setSessionToken('')
    setSession(null)
    setMyArticles([])
    setAuthError('Sua sessão expirou. Entre novamente para continuar.')
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
          depth: '1',
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
    if (!coverFile) return
    const objectUrl = URL.createObjectURL(coverFile)
    setCoverPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [coverFile])

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
        setAuthError('')
      } catch {
        /* Mantém estado atual caso o serviço esteja temporariamente indisponível. */
      }
    })()
    return () => {
      active = false
    }
  }, [cmsUrl, token, handleSessionExpired])

  useEffect(() => {
    if (!BLOG_TEST_UI || autotestInitializedRef.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('autotest') !== '1') return

    autotestInitializedRef.current = true
    setIsOpen(true)
    applySampleDraft([])

    if (!token) {
      void (async () => {
        try {
          const nextSession = await loginWithSharedSession(
            'autora@gnuverse.local',
            'gnuverse123',
          )
          setSessionToken(nextSession.token)
          setSession(nextSession)
        } catch {
          /* Silencioso caso a conta de demonstração ainda não exista. */
        }
      })()
    }
  }, [applySampleDraft, setSessionToken, token])

  useEffect(() => {
    if (isOpen && session) {
      void loadMyArticles(session)
    }
  }, [isOpen, session, loadMyArticles])

  const handleStartEdit = useCallback(
    (doc: SubmissionArticle) => {
      setEditingId(String(doc.id))
      setTitle(doc.title || '')
      setSlug(doc.slug || '')
      setSlugTouched(true)
      setSummary(doc.summary || '')
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
      setCoverFile(null)
      setCoverRemoved(false)
      if (coverFileInputRef.current) coverFileInputRef.current.value = ''
      if (doc.cover && typeof doc.cover === 'object') {
        setCoverMedia(doc.cover)
        setCoverPreviewUrl(
          cmsUrl ? resolveMediaUrl(cmsUrl, doc.cover.url) : doc.cover.url || '',
        )
        setCoverAlt(doc.cover.alt || '')
        setCoverCredit(doc.cover.credit || '')
      } else {
        setCoverMedia(null)
        setCoverPreviewUrl('')
        setCoverAlt('')
        setCoverCredit('')
      }
      setSubmitError('')
      setSubmitSuccess(
        `Editando "${doc.title}". Ao finalizar, salve o rascunho ou envie novamente para revisão.`,
      )
      titleInputRef.current?.focus()
    },
    [cmsUrl],
  )

  useEffect(() => {
    if (initialEditLoadedRef.current || myArticles.length === 0) return
    const editId = new URLSearchParams(window.location.search).get('id')
    if (!editId) return
    const target = myArticles.find((doc) => String(doc.id) === editId)
    if (target && canAuthorEditSubmission(target)) {
      initialEditLoadedRef.current = true
      handleStartEdit(target)
    }
  }, [myArticles, handleStartEdit])

  async function handleQuickLogin(email: string) {
    setAuthError('')
    setSubmitError('')
    setSubmitSuccess('')
    setAuthBusy(true)
    try {
      const nextSession = await loginWithSharedSession(email, 'gnuverse123')
      setSessionToken(nextSession.token)
      setSession(nextSession)
      await loadMyArticles(nextSession)
    } catch (cause) {
      setAuthError(formatRequestFailure(cause))
    } finally {
      setAuthBusy(false)
    }
  }

  function handleFillSampleArticle() {
    applySampleDraft(myArticles)
    setSubmitSuccess(
      'Artigo de exemplo preenchido! Clique em "Enviar para revisão" ou "Salvar rascunho".',
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
    resetForm()
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

  function handleCoverFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    setCoverFile(file)
    setCoverMedia(null)
    setCoverRemoved(false)
    if (!coverCredit && session) {
      setCoverCredit(resolveAuthorName(session.user))
    }
  }

  function applyFormatting(
    before: string,
    after: string,
    placeholder: string,
    linePrefix?: string,
  ) {
    const textarea = bodyTextareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart ?? bodyText.length
    const end = textarea.selectionEnd ?? bodyText.length
    const selected = bodyText.slice(start, end)

    let replacement: string
    if (linePrefix) {
      const content = selected || placeholder
      replacement = content
        .split('\n')
        .map((line) => `${linePrefix}${line}`)
        .join('\n')
      if (start > 0 && bodyText[start - 1] !== '\n') {
        replacement = `\n\n${replacement}`
      }
    } else {
      replacement = `${before}${selected || placeholder}${after}`
    }

    const nextText =
      bodyText.slice(0, start) + replacement + bodyText.slice(end)
    setBodyText(nextText)
    requestAnimationFrame(() => {
      textarea.focus()
      const cursor = start + replacement.length
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  function handleInsertLink() {
    const url = window.prompt('Informe o link (https://...):', 'https://')
    if (!url || !/^https?:\/\//i.test(url.trim())) return
    applyFormatting('[', `](${url.trim()})`, 'texto do link')
  }

  async function handleInlineImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !session || !cmsUrl) return

    const altPrompt = window.prompt(
      'Descrição da imagem (acessibilidade):',
      file.name.replace(/\.[^.]+$/, ''),
    )
    const alt = (altPrompt ?? '').trim() || file.name.replace(/\.[^.]+$/, '') || 'Imagem do artigo'
    const credit = resolveAuthorName(session.user) || 'Autor'

    setInlineImageBusy(true)
    setSubmitError('')
    try {
      const media = await uploadMediaFile(cmsUrl, session.token, file, alt, credit)
      const mediaUrl = resolveMediaUrl(cmsUrl, media.url)
      const tokenMarkdown = `![${alt}](cms-media:${media.id}${mediaUrl ? `|${mediaUrl}` : ''})`
      const textarea = bodyTextareaRef.current
      const start = textarea?.selectionStart ?? bodyText.length
      const prefix = start > 0 && !bodyText.slice(0, start).endsWith('\n\n') ? '\n\n' : ''
      const suffix = '\n\n'
      const next =
        bodyText.slice(0, start) + prefix + tokenMarkdown + suffix + bodyText.slice(start)
      setBodyText(next)
      setSubmitSuccess('Imagem anexada ao texto do artigo.')
    } catch (cause) {
      setSubmitError(formatRequestFailure(cause))
    } finally {
      setInlineImageBusy(false)
    }
  }

  async function handleSaveSubmission(targetReviewStatus: 'draft' | 'in_review') {
    if (!session || !cmsUrl) return
    setSubmitError('')
    setSubmitSuccess('')

    const author = resolveAuthorName(session.user)
    if (coverFile && !coverAlt.trim()) {
      setSubmitError('Informe uma descrição de acessibilidade para a imagem de capa.')
      return
    }
    if (coverFile && !coverCredit.trim()) {
      setSubmitError('Informe a autoria ou licença da imagem de capa.')
      return
    }

    const parsedHashtags = parseHashtagsInput(hashtagsInput)
    const validated = validateSubmissionInput({
      title,
      slug,
      summary,
      author,
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
      let coverId: string | number | null | undefined = undefined
      if (coverFile) {
        const uploaded = await uploadMediaFile(
          cmsUrl,
          session.token,
          coverFile,
          coverAlt.trim(),
          coverCredit.trim(),
        )
        setCoverMedia(uploaded)
        setCoverFile(null)
        coverId = uploaded.id
      } else if (coverMedia) {
        coverId = coverMedia.id
      } else if (coverRemoved) {
        coverId = null
      }

      const endpoint = editingId
        ? `${cmsUrl}/api/articles/${encodeURIComponent(editingId)}?draft=true`
        : `${cmsUrl}/api/articles?draft=true`
      const method = editingId ? 'PATCH' : 'POST'
      const { hashtags, ...submissionPayload } = validated.data

      const payloadBody: Record<string, unknown> = {
        ...submissionPayload,
        hashtags: hashtags.map((tag) => ({ tag })),
        reviewStatus: targetReviewStatus,
        _status: 'draft',
      }
      if (coverId !== undefined) {
        payloadBody.cover = coverId
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify(payloadBody),
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
        resetForm()
        setSubmitSuccess(
          'Artigo enviado para revisão editorial. Acompanhe o andamento abaixo.',
        )
      } else {
        if (savedDoc?.id !== undefined) {
          setEditingId(String(savedDoc.id))
          setSlugTouched(true)
        }
        setSubmitSuccess(
          'Rascunho salvo. Você pode continuar editando ou enviar para revisão.',
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
  const returnNext = standalone ? '/blog/escrever/' : '/blog/'
  const inputClass =
    'mt-1.5 w-full rounded-sm border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none'
  const toolButtonClass =
    'cursor-pointer rounded-sm border border-[var(--line)] bg-[var(--background)] px-2.5 py-1 text-xs text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <section
      ref={sectionRef}
      aria-label="Submissão editorial"
      className={standalone ? 'mt-8' : ''}
    >
      {!standalone && (
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
      )}

      {(standalone || isOpen) && (
        <div
          id="editorial-submission-body"
          className={`${standalone ? '' : 'mt-8 '}rounded-sm border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8`}
        >
          {BLOG_TEST_UI && (
            <div className="mb-5 rounded-sm border border-[var(--accent)] bg-[var(--accent-soft)] p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold uppercase tracking-wider text-[var(--accent)]">
                  Atalhos de Teste Rápido (Ambiente Local)
                </p>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {QUICK_TEST_ACCOUNTS.map((account) => {
                  const isActive = session?.user.email === account.email
                  return (
                    <button
                      key={account.email}
                      type="button"
                      disabled={authBusy}
                      onClick={() => void handleQuickLogin(account.email)}
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
              </div>
            </div>
          )}

          <p className="rounded-sm border border-[var(--line)] bg-[var(--surface-raised)] p-3.5 text-xs leading-relaxed text-[var(--muted)]">
            Os textos enviados entram como rascunho ou revisão editorial e só
            vão ao ar após aprovação de um revisor.
          </p>

          {cmsUrl === null ? (
            <div className="mt-6 rounded-sm border border-[var(--line)] bg-[var(--background)] p-5">
              <p className="text-sm leading-relaxed text-[var(--ink)]">
                O envio de artigos está indisponível neste ambiente no momento.
                A leitura dos artigos publicados funciona normalmente.
              </p>
            </div>
          ) : !session ? (
            <div className="mt-6 rounded-sm border border-[var(--line)] bg-[var(--background)] p-5">
              <p className="text-sm leading-relaxed text-[var(--ink)]">
                Para enviar artigos para revisão editorial e acompanhar suas
                submissões, entre na sua conta ou crie um cadastro.
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
                  href={`/login/?next=${encodeURIComponent(returnNext)}`}
                  className="rounded-sm border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)]"
                >
                  Entrar
                </Link>
                <Link
                  href={`/cadastro/?next=${encodeURIComponent(returnNext)}`}
                  className="rounded-sm border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  Criar conta
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-10">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
                <div>
                  <p className="text-sm font-medium text-[var(--ink)]">
                    Autoria: {resolveAuthorName(session.user)}
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
                  <h2 className="text-xl tracking-tight">
                    {editingId ? 'Editar rascunho' : 'Novo artigo para revisão'}
                  </h2>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        resetForm()
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

                <div className="rounded-sm border border-[var(--line)] bg-[var(--background)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="submission-cover"
                      className="text-sm font-medium text-[var(--ink)]"
                    >
                      Imagem de capa (opcional)
                    </label>
                    {(coverPreviewUrl || coverFile || coverMedia) && (
                      <button
                        type="button"
                        onClick={() => {
                          clearCoverSelection()
                          setCoverRemoved(true)
                        }}
                        className="cursor-pointer text-xs text-[var(--secondary)] underline underline-offset-4"
                      >
                        Remover capa
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Formatos aceitos: JPEG, PNG ou WebP (até 5 MB).
                  </p>
                  <input
                    ref={coverFileInputRef}
                    id="submission-cover"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleCoverFileChange}
                    className="mt-2 block w-full text-xs text-[var(--muted)] file:mr-3 file:cursor-pointer file:rounded-sm file:border file:border-[var(--line)] file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-xs file:text-[var(--ink)] hover:file:border-[var(--accent)]"
                  />
                  {coverPreviewUrl && (
                    <div className="mt-3 space-y-3">
                      <img
                        src={coverPreviewUrl}
                        alt={coverAlt || 'Pré-visualização da capa'}
                        className="max-h-56 w-auto rounded-sm border border-[var(--line)] object-cover"
                      />
                      {coverFile && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-xs text-[var(--muted)]">
                            Descrição da imagem (acessibilidade)
                            <input
                              type="text"
                              value={coverAlt}
                              onChange={(e) => setCoverAlt(e.target.value)}
                              placeholder="Ex.: Estudantes em laboratório de computação"
                              className={inputClass}
                            />
                          </label>
                          <label className="block text-xs text-[var(--muted)]">
                            Crédito / licença
                            <input
                              type="text"
                              value={coverCredit}
                              onChange={(e) => setCoverCredit(e.target.value)}
                              placeholder="Ex.: Foto por Ana · CC BY-SA 4.0"
                              className={inputClass}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
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
                    Use a barra abaixo para formatar trechos, títulos, listas,
                    links e anexar imagens ao corpo do texto.
                  </p>
                  <div
                    role="toolbar"
                    aria-label="Formatação do artigo"
                    className="mt-2 flex flex-wrap items-center gap-1.5 rounded-sm border border-[var(--line)] bg-[var(--surface-raised)] p-2"
                  >
                    <button
                      type="button"
                      onClick={() => applyFormatting('**', '**', 'negrito')}
                      className={toolButtonClass}
                    >
                      <strong>Negrito</strong>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('*', '*', 'itálico')}
                      className={toolButtonClass}
                    >
                      <em>Itálico</em>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('', '', 'Subtítulo', '## ')}
                      className={toolButtonClass}
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('', '', 'Seção', '### ')}
                      className={toolButtonClass}
                    >
                      H3
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('', '', 'Item da lista', '- ')}
                      className={toolButtonClass}
                    >
                      Lista
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('', '', 'Primeiro item', '1. ')}
                      className={toolButtonClass}
                    >
                      1. Lista
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('', '', 'Citação', '> ')}
                      className={toolButtonClass}
                    >
                      Citação
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('`', '`', 'código')}
                      className={toolButtonClass}
                    >
                      Código
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertLink}
                      className={toolButtonClass}
                    >
                      Link
                    </button>
                    <button
                      type="button"
                      disabled={inlineImageBusy}
                      onClick={() => inlineFileInputRef.current?.click()}
                      className={toolButtonClass}
                    >
                      {inlineImageBusy ? 'Enviando imagem…' : 'Anexar imagem'}
                    </button>
                    <input
                      ref={inlineFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => void handleInlineImageUpload(e)}
                      className="hidden"
                    />
                  </div>
                  <textarea
                    ref={bodyTextareaRef}
                    id="submission-body"
                    required
                    rows={12}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder={
                      'Primeiro parágrafo do artigo...\n\n## Subtítulo\n\nSegundo parágrafo com **destaque**, listas ou imagens...'
                    }
                    className={`${inputClass} font-mono text-[13px] leading-relaxed`}
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
                    Enviando… Isso pode levar alguns instantes.
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
                  <h2 className="text-xl tracking-tight">Minhas submissões</h2>
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
                                {updatedText
                                  ? `Atualizado em ${updatedText}`
                                  : 'Rascunho'}
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
