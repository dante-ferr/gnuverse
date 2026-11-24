import { APIError, type CollectionConfig, type FieldAccess, type Where } from 'payload'
import {
  adminField,
  canCreateArticle,
  canReadArticle,
  canReadArticleVersions,
  isAuthor,
  isReviewer,
  isReviewerField,
} from '../access'
import { deployAfterChange, deployAfterDelete } from '../hooks/deploy-site'

function getOwnerId(owner: unknown): number | string | undefined {
  if (typeof owner === 'object' && owner !== null && 'id' in owner) {
    const { id } = owner as { id?: unknown }
    return typeof id === 'number' || typeof id === 'string' ? id : undefined
  }
  return typeof owner === 'number' || typeof owner === 'string' ? owner : undefined
}

function isSafeBodyHref(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/\\') || trimmed.startsWith('\\')) return false
  if ((trimmed.startsWith('/') && !trimmed.startsWith('//')) || trimmed.startsWith('#')) {
    return true
  }
  try {
    const parsed = new URL(trimmed)
    return ['https:', 'http:', 'mailto:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

function assertSafeLexicalNode(node: unknown): void {
  if (!node || typeof node !== 'object') return
  const record = node as Record<string, unknown>
  if (record.type === 'relationship') {
    throw new APIError('Bloco de relação não permitido no corpo do artigo.', 400)
  }
  if (record.type === 'upload' && record.relationTo !== 'media') {
    throw new APIError('Apenas imagens da biblioteca são permitidas no corpo do artigo.', 400)
  }
  if (record.type === 'link' || record.type === 'autolink') {
    const fields = record.fields as Record<string, unknown> | undefined
    const rawUrl = fields?.url ?? record.url
    if (!isSafeBodyHref(rawUrl)) {
      throw new APIError('Link inválido no corpo do artigo. Use apenas HTTP, HTTPS, mailto ou caminhos relativos.', 400)
    }
  }
  if (Array.isArray(record.children)) {
    for (const child of record.children) assertSafeLexicalNode(child)
  }
}

function normalizeHashtagItems(raw: unknown[]): Array<Record<string, unknown>> {
  const seen = new Set<string>()
  const result: Array<Record<string, unknown>> = []
  for (const item of raw) {
    const rawTag =
      typeof item === 'string'
        ? item
        : typeof item === 'object' && item !== null && 'tag' in item && typeof (item as { tag?: unknown }).tag === 'string'
          ? (item as { tag: string }).tag
          : ''
    const normalized = rawTag
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^#+/, '')
      .toLowerCase()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(
      typeof item === 'object' && item !== null
        ? { ...(item as Record<string, unknown>), tag: normalized }
        : { tag: normalized },
    )
    if (result.length >= 10) break
  }
  return result
}

const canReadReviewNotes: FieldAccess = ({ doc, req }) => {
  if (!req.user) return false
  if (isReviewer({ req })) return true
  if (isAuthor({ req })) {
    const ownerId = getOwnerId(doc?.owner)
    return ownerId !== undefined && ownerId === req.user.id
  }
  return false
}

const canReadOwner: FieldAccess = ({ doc, req }) => {
  if (!req.user) return false
  if (isReviewer({ req })) return true
  if (isAuthor({ req })) {
    // Quando `doc` é undefined, o Payload está validando o caminho `where[owner][equals]` na query.
    if (!doc) return true
    const ownerId = getOwnerId(doc.owner)
    return ownerId !== undefined && ownerId === req.user.id
  }
  return false
}

export const Articles: CollectionConfig = {
  slug: 'articles',
  labels: { singular: 'Artigo', plural: 'Artigos' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'author', '_status', 'updatedAt'] },
  access: {
    read: canReadArticle,
    readVersions: canReadArticleVersions,
    create: canCreateArticle,
    update: ({ req }) =>
      isReviewer({ req }) ? true : isAuthor({ req }) && req.user ? { owner: { equals: req.user.id } } : false,
    delete: ({ req }) => {
      if (isReviewer({ req })) return true
      if (isAuthor({ req }) && req.user) {
        const where: Where = {
          and: [{ owner: { equals: req.user.id } }, { _status: { not_equals: 'published' } }],
        }
        return where
      }
      return false
    },
  },
  versions: { drafts: true, maxPerDoc: 20 },
  hooks: {
    beforeOperation: [
      ({ args, operation, req }) => {
        if (operation === 'create') {
          req.context.submittedStatus = args.data?._status
          req.context.submittedReviewStatus = args.data?.reviewStatus
        } else if (operation === 'update' || operation === 'restoreVersion') {
          req.context.isDraftArg = Boolean(args.draft)
          if ('data' in args && args.data) {
            req.context.submittedStatus = args.data._status
            req.context.submittedReviewStatus = args.data.reviewStatus
          }
        }
        return args
      },
    ],
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        if (data.body && typeof data.body === 'object' && 'root' in data.body) {
          assertSafeLexicalNode((data.body as { root?: unknown }).root)
        }

        if (operation === 'create' && !data.owner && req.user) {
          data.owner = req.user.id
        }
        if (operation === 'create' && (typeof data.author !== 'string' || !data.author.trim()) && req.user) {
          data.author = req.user.name || req.user.username || req.user.email
        }
        if (operation === 'update' && !isReviewer({ req }) && originalDoc?.owner) {
          data.owner = getOwnerId(originalDoc.owner)
        }

        if (isAuthor({ req })) {
          if (req.context.submittedStatus === 'published') {
            throw new APIError('Autores não podem publicar artigos diretamente. Envie para revisão.', 403)
          }
          // `originalDoc` em updates de rascunho vem da última versão em `_articles_v`, não da linha principal em `articles`.
          let persistedStatus = originalDoc?._status
          if (operation === 'update' && originalDoc?.id) {
            const persistedDoc = await req.payload.findByID({
              collection: 'articles',
              id: originalDoc.id,
              draft: false,
              depth: 0,
              overrideAccess: true,
              req,
            })
            persistedStatus = persistedDoc?._status
          }

          if (operation === 'update' && persistedStatus === 'published' && !req.context.isDraftArg) {
            throw new APIError('Artigos já publicados só podem receber novas versões como rascunho para revisão.', 403)
          }
          if (data._status === 'published') {
            throw new APIError('Autores não podem publicar artigos diretamente. Envie para revisão.', 403)
          }

          const isDraftOverPublished =
            operation === 'update' && persistedStatus === 'published' && Boolean(req.context.isDraftArg)

          if (isDraftOverPublished && data.reviewStatus === 'approved') {
            // Nova revisão em rascunho de artigo já publicado precisa de nova aprovação editorial.
            data.reviewStatus = 'draft'
          } else if (data.reviewStatus === 'approved' || data.reviewStatus === 'changes_requested') {
            const isUnchangedFeedback =
              operation === 'update' &&
              data.reviewStatus === 'changes_requested' &&
              originalDoc?.reviewStatus === 'changes_requested'
            if (!isUnchangedFeedback) {
              throw new APIError('Somente revisores ou administradores podem definir este status de revisão.', 403)
            }
          }

          data._status = 'draft'
          if (!data.reviewStatus) data.reviewStatus = 'draft'
          req.context.skipSiteDeploy = true
        } else if (isReviewer({ req }) && data._status === 'published') {
          data.reviewStatus = 'approved'
        }

        if (Array.isArray(data.hashtags)) {
          data.hashtags = normalizeHashtagItems(data.hashtags)
        }

        if (data._status === 'published' && !data.publishedAt && !originalDoc?.publishedAt) {
          data.publishedAt = new Date().toISOString()
        }

        return data
      },
    ],
    afterChange: [deployAfterChange],
    afterDelete: [deployAfterDelete],
  },
  fields: [
    { name: 'title', label: 'Título', type: 'text', required: true },
    {
      name: 'slug', label: 'Endereço do artigo', type: 'text', required: true, unique: true, index: true,
      admin: { description: 'Use letras minúsculas, números e hífens. Exemplo: tecnologia-para-mais-gente' },
      validate: (value: unknown) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || 'Use apenas letras minúsculas, números e hífens entre palavras.',
    },
    { name: 'summary', label: 'Resumo', type: 'textarea', required: true, maxLength: 300 },
    { name: 'author', label: 'Autoria', type: 'text', required: true },
    {
      name: 'owner',
      label: 'Conta autora',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: { position: 'sidebar', readOnly: true },
      access: { read: canReadOwner, create: adminField, update: adminField },
    },
    {
      name: 'reviewStatus',
      label: 'Status da revisão',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Rascunho', value: 'draft' },
        { label: 'Em revisão', value: 'in_review' },
        { label: 'Ajustes solicitados', value: 'changes_requested' },
        { label: 'Aprovado', value: 'approved' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'reviewNotes',
      label: 'Devolutiva da revisão',
      type: 'textarea',
      maxLength: 1000,
      admin: {
        position: 'sidebar',
        description: 'Critérios, ajustes necessários ou observações da revisão editorial.',
      },
      access: { read: canReadReviewNotes, create: isReviewerField, update: isReviewerField },
    },
    { name: 'category', label: 'Categoria', type: 'select', required: false, defaultValue: 'reflexoes', admin: { hidden: true }, options: [
      { label: 'Reflexões', value: 'reflexoes' },
      { label: 'Educação', value: 'educacao' },
      { label: 'Acesso', value: 'acesso' },
      { label: 'Experiências', value: 'experiencias' },
    ] },
    { name: 'cover', label: 'Imagem de capa (opcional)', type: 'upload', relationTo: 'media' },
    {
      name: 'publishedAt',
      label: 'Data de publicação',
      type: 'date',
      admin: { position: 'sidebar' },
      access: { create: isReviewerField, update: isReviewerField },
    },
    {
      name: 'hashtags',
      label: 'Hashtags',
      type: 'array',
      maxRows: 10,
      fields: [
        {
          name: 'tag',
          label: 'Hashtag',
          type: 'text',
          required: true,
          validate: (value: unknown) =>
            (typeof value === 'string' && /^[a-z0-9][a-z0-9-_]{0,39}$/.test(value.trim().replace(/^#/, '').toLowerCase())) ||
            'Use apenas letras minúsculas, números, hífen ou sublinhado (até 40 caracteres).',
        },
      ],
    },
    { name: 'body', label: 'Texto', type: 'richText', required: true },
    { name: 'references', label: 'Referências', type: 'array', fields: [
      { name: 'label', label: 'Título da fonte', type: 'text', required: true },
      { name: 'url', label: 'Link', type: 'text', required: true, validate: (value: unknown) => {
        try { return typeof value === 'string' && ['https:', 'http:'].includes(new URL(value).protocol) || 'Use um link HTTP ou HTTPS.' }
        catch { return 'Use um link válido.' }
      } },
    ] },
  ],
}
