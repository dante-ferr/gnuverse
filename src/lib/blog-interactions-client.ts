import { resolveCmsBaseUrl } from './cms-client'

export const COMMENT_MAX_LENGTH = 1000

export type PublicCommentAuthor = {
  id: string
  name: string
  avatar: {
    url: string
    alt: string
  } | null
}

export type ArticleComment = {
  id: string
  content: string
  createdAt: string
  author: PublicCommentAuthor
  canDelete: boolean
}

export type ArticleInteractionsData = {
  likesCount: number
  likedByMe: boolean
  comments: ArticleComment[]
}

function resolveMediaUrl(cmsUrl: string, rawUrl: string): string {
  try {
    return new URL(rawUrl, `${cmsUrl}/`).href
  } catch {
    return rawUrl
  }
}

function normalizeComment(cmsUrl: string, raw: unknown): ArticleComment | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id : ''
  const content = typeof record.content === 'string' ? record.content : ''
  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : ''
  if (!id || !content) return null

  const rawAuthor =
    record.author && typeof record.author === 'object'
      ? (record.author as Record<string, unknown>)
      : null
  const authorId = rawAuthor && typeof rawAuthor.id === 'string' ? rawAuthor.id : ''
  const authorName =
    rawAuthor && typeof rawAuthor.name === 'string' && rawAuthor.name.trim()
      ? rawAuthor.name.trim()
      : 'Participante'
  const rawAvatar =
    rawAuthor?.avatar && typeof rawAuthor.avatar === 'object'
      ? (rawAuthor.avatar as Record<string, unknown>)
      : null
  const avatar =
    rawAvatar && typeof rawAvatar.url === 'string' && rawAvatar.url.trim()
      ? {
          url: resolveMediaUrl(cmsUrl, rawAvatar.url.trim()),
          alt:
            typeof rawAvatar.alt === 'string' && rawAvatar.alt.trim()
              ? rawAvatar.alt.trim()
              : `Foto de ${authorName}`,
        }
      : null

  return {
    id,
    content,
    createdAt,
    author: {
      id: authorId,
      name: authorName,
      avatar,
    },
    canDelete: record.canDelete === true,
  }
}

function requireCmsUrl(): string {
  const cmsUrl = resolveCmsBaseUrl()
  if (!cmsUrl) {
    throw new Error('Servidor editorial (CMS) indisponível neste ambiente.')
  }
  return cmsUrl
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null)
  if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
    return (data as { error: string }).error
  }
  return fallback
}

export async function fetchArticleInteractions(
  slug: string,
  token?: string,
): Promise<ArticleInteractionsData> {
  const cmsUrl = requireCmsUrl()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(
    `${cmsUrl}/api/articles/${encodeURIComponent(slug)}/interactions`,
    {
      headers,
      signal: AbortSignal.timeout(30000),
    },
  )
  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, 'Não foi possível carregar curtidas e comentários.'),
    )
  }
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
  const rawComments = Array.isArray(data?.comments) ? data.comments : []
  const comments = rawComments
    .map((entry) => normalizeComment(cmsUrl, entry))
    .filter((entry): entry is ArticleComment => entry !== null)

  return {
    likesCount: typeof data?.likesCount === 'number' ? data.likesCount : 0,
    likedByMe: data?.likedByMe === true,
    comments,
  }
}

export async function toggleArticleLike(
  slug: string,
  token: string,
): Promise<{ likesCount: number; likedByMe: boolean }> {
  const cmsUrl = requireCmsUrl()
  const response = await fetch(
    `${cmsUrl}/api/articles/${encodeURIComponent(slug)}/like`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    },
  )
  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, 'Não foi possível registrar sua curtida.'),
    )
  }
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
  return {
    likesCount: typeof data?.likesCount === 'number' ? data.likesCount : 0,
    likedByMe: data?.likedByMe === true,
  }
}

export async function createArticleComment(
  slug: string,
  token: string,
  content: string,
): Promise<ArticleComment> {
  const cmsUrl = requireCmsUrl()
  const response = await fetch(
    `${cmsUrl}/api/articles/${encodeURIComponent(slug)}/comments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(30000),
    },
  )
  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, 'Não foi possível publicar seu comentário.'),
    )
  }
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
  const comment = normalizeComment(cmsUrl, data?.comment)
  if (!comment) {
    throw new Error('Resposta inválida ao publicar o comentário.')
  }
  return comment
}

export async function deleteArticleComment(
  slug: string,
  token: string,
  commentId: string,
): Promise<void> {
  const cmsUrl = requireCmsUrl()
  const response = await fetch(
    `${cmsUrl}/api/articles/${encodeURIComponent(slug)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    },
  )
  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, 'Não foi possível apagar o comentário.'),
    )
  }
}
