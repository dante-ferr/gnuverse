import type { Endpoint, PayloadRequest } from 'payload'
import { isAdmin } from '../access'
import {
  checkCommentSpamGuard,
  consumeLikeRateLimit,
  recordCommentAccepted,
  validateCommentContent,
} from './interactions-guard'

type PopulatedMedia = {
  url?: string | null
  alt?: string | null
}

type PopulatedUser = {
  id: number | string
  name?: string | null
  avatar?: PopulatedMedia | number | string | null
}

type CommentDoc = {
  id: number | string
  content: string
  createdAt: string
  article: number | string | { id: number | string }
  author: PopulatedUser | number | string
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COMMENTS_LIMIT = 100

function getRouteParam(req: PayloadRequest, name: string): string {
  const value = req.routeParams?.[name]
  return typeof value === 'string' ? value.trim() : ''
}

function getRelationId(value: number | string | { id?: number | string } | null | undefined): string {
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  if (value && typeof value === 'object' && (typeof value.id === 'number' || typeof value.id === 'string')) {
    return String(value.id)
  }
  return ''
}

function formatPublicAuthor(author: CommentDoc['author']) {
  if (author && typeof author === 'object') {
    const name =
      typeof author.name === 'string' && author.name.trim().length > 0
        ? author.name.trim()
        : 'Participante'
    const media = author.avatar && typeof author.avatar === 'object' ? author.avatar : null
    const avatar =
      media && typeof media.url === 'string' && media.url.trim().length > 0
        ? {
            url: media.url,
            alt:
              typeof media.alt === 'string' && media.alt.trim().length > 0
                ? media.alt.trim()
                : `Foto de ${name}`,
          }
        : null
    return {
      id: String(author.id),
      name,
      avatar,
    }
  }
  return {
    id: String(author),
    name: 'Participante',
    avatar: null,
  }
}

function formatPublicComment(doc: CommentDoc, req: PayloadRequest) {
  const author = formatPublicAuthor(doc.author)
  const canDelete = Boolean(
    req.user && (String(req.user.id) === author.id || isAdmin({ req })),
  )
  return {
    id: String(doc.id),
    content: doc.content,
    createdAt: doc.createdAt,
    author,
    canDelete,
  }
}

async function findPublishedArticleBySlug(req: PayloadRequest, slug: string) {
  if (!SLUG_PATTERN.test(slug)) return null
  const found = await req.payload.find({
    collection: 'articles',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: {
      and: [
        { slug: { equals: slug } },
        { _status: { equals: 'published' } },
      ],
    },
    req,
  })
  return found.docs[0] ?? null
}

async function countArticleLikes(req: PayloadRequest, articleId: number | string): Promise<number> {
  const result = await req.payload.count({
    collection: 'article-likes',
    overrideAccess: true,
    where: { article: { equals: articleId } },
    req,
  })
  return result.totalDocs
}

function isDuplicateKeyError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.message} ${String((error as { cause?: unknown }).cause ?? '')}`
      : String(error)
  return (
    /unique|duplicate|SQLITE_CONSTRAINT|23505|likeKey/i.test(message)
  )
}

export const blogInteractionEndpoints: Endpoint[] = [
  {
    path: '/articles/:slug/interactions',
    method: 'get',
    handler: async (req) => {
      const slug = getRouteParam(req, 'slug')
      const article = await findPublishedArticleBySlug(req, slug)
      if (!article) {
        return Response.json(
          { error: 'Artigo não encontrado.' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      const [likesCount, likedCheck, commentsResult] = await Promise.all([
        countArticleLikes(req, article.id),
        req.user
          ? req.payload.count({
              collection: 'article-likes',
              overrideAccess: true,
              where: { likeKey: { equals: `${article.id}:${req.user.id}` } },
              req,
            })
          : Promise.resolve({ totalDocs: 0 }),
        req.payload.find({
          collection: 'article-comments',
          overrideAccess: true,
          depth: 2,
          limit: COMMENTS_LIMIT,
          sort: '-createdAt',
          where: { article: { equals: article.id } },
          req,
        }),
      ])

      const comments = (commentsResult.docs as unknown as CommentDoc[]).map((doc) =>
        formatPublicComment(doc, req),
      )

      return Response.json(
        {
          likesCount,
          likedByMe: likedCheck.totalDocs > 0,
          comments,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    },
  },
  {
    path: '/articles/:slug/like',
    method: 'post',
    handler: async (req) => {
      if (!req.user) {
        return Response.json(
          { error: 'Entre na sua conta para curtir este artigo.' },
          { status: 401, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      const rate = consumeLikeRateLimit(String(req.user.id))
      if (!rate.ok) {
        return Response.json(
          { error: rate.error },
          {
            status: 429,
            headers: {
              'Cache-Control': 'no-store',
              'Retry-After': String(rate.retryAfterSeconds),
            },
          },
        )
      }

      const slug = getRouteParam(req, 'slug')
      const article = await findPublishedArticleBySlug(req, slug)
      if (!article) {
        return Response.json(
          { error: 'Artigo não encontrado.' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      const likeKey = `${article.id}:${req.user.id}`
      const existing = await req.payload.find({
        collection: 'article-likes',
        overrideAccess: true,
        depth: 0,
        limit: 1,
        where: { likeKey: { equals: likeKey } },
        req,
      })

      let likedByMe: boolean
      if (existing.docs[0]) {
        await req.payload.delete({
          collection: 'article-likes',
          id: existing.docs[0].id,
          overrideAccess: true,
          req,
        })
        likedByMe = false
      } else {
        try {
          await req.payload.create({
            collection: 'article-likes',
            overrideAccess: true,
            req,
            data: {
              article: article.id,
              user: req.user.id,
              likeKey,
            },
          })
        } catch (error) {
          // Concurrent double-click race on unique likeKey: treat as already liked.
          if (!isDuplicateKeyError(error)) throw error
        }
        likedByMe = true
      }

      const likesCount = await countArticleLikes(req, article.id)
      return Response.json(
        { likesCount, likedByMe },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      )
    },
  },
  {
    path: '/articles/:slug/comments',
    method: 'post',
    handler: async (req) => {
      if (!req.user) {
        return Response.json(
          { error: 'Entre na sua conta para comentar neste artigo.' },
          { status: 401, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      if (!req.headers.get('content-type')?.startsWith('application/json')) {
        return Response.json({ error: 'Envie JSON.' }, { status: 415 })
      }
      const raw = await req.text!()
      if (raw.length > 8192) {
        return Response.json({ error: 'Pedido muito grande.' }, { status: 413 })
      }
      let body: Record<string, unknown>
      try {
        body = JSON.parse(raw)
      } catch {
        return Response.json({ error: 'Pedido inválido.' }, { status: 400 })
      }

      const slug = getRouteParam(req, 'slug')
      const article = await findPublishedArticleBySlug(req, slug)
      if (!article) {
        return Response.json(
          { error: 'Artigo não encontrado.' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      const validation = validateCommentContent(body.content)
      if (!validation.ok) {
        return Response.json(
          { error: validation.error },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      const userId = String(req.user.id)
      const articleId = String(article.id)
      const guard = checkCommentSpamGuard(userId, articleId, validation.content)
      if (!guard.ok) {
        return Response.json(
          { error: guard.error },
          {
            status: guard.status,
            headers: {
              'Cache-Control': 'no-store',
              ...(guard.retryAfterSeconds
                ? { 'Retry-After': String(guard.retryAfterSeconds) }
                : {}),
            },
          },
        )
      }

      const created = await req.payload.create({
        collection: 'article-comments',
        overrideAccess: true,
        req,
        data: {
          article: article.id,
          author: req.user.id,
          content: validation.content,
        },
      })

      recordCommentAccepted(userId, articleId, validation.content)

      const populated = (await req.payload.findByID({
        collection: 'article-comments',
        id: created.id,
        depth: 2,
        overrideAccess: true,
        req,
      })) as unknown as CommentDoc

      return Response.json(
        { comment: formatPublicComment(populated, req) },
        { status: 201, headers: { 'Cache-Control': 'no-store' } },
      )
    },
  },
  {
    path: '/articles/:slug/comments/:id',
    method: 'delete',
    handler: async (req) => {
      if (!req.user) {
        return Response.json(
          { error: 'Entre na sua conta para apagar um comentário.' },
          { status: 401, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      const slug = getRouteParam(req, 'slug')
      const commentId = getRouteParam(req, 'id')
      if (!commentId) {
        return Response.json({ error: 'Comentário inválido.' }, { status: 400 })
      }

      const article = await findPublishedArticleBySlug(req, slug)
      if (!article) {
        return Response.json(
          { error: 'Artigo não encontrado.' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      let comment: CommentDoc
      try {
        comment = (await req.payload.findByID({
          collection: 'article-comments',
          id: commentId,
          depth: 0,
          overrideAccess: true,
          req,
        })) as unknown as CommentDoc
      } catch {
        return Response.json(
          { error: 'Comentário não encontrado.' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      if (getRelationId(comment.article) !== String(article.id)) {
        return Response.json(
          { error: 'Comentário não encontrado neste artigo.' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      const authorId = getRelationId(comment.author)
      const allowed = String(req.user.id) === authorId || isAdmin({ req })
      if (!allowed) {
        return Response.json(
          { error: 'Você não tem permissão para apagar este comentário.' },
          { status: 403, headers: { 'Cache-Control': 'no-store' } },
        )
      }

      await req.payload.delete({
        collection: 'article-comments',
        id: comment.id,
        overrideAccess: true,
        req,
      })

      return Response.json(
        { deleted: true, id: String(comment.id) },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      )
    },
  },
]
