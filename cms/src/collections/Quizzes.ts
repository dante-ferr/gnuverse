import { createHash } from 'node:crypto'
import {
  APIError,
  type CollectionConfig,
  type FieldAccess,
  type Where,
} from 'payload'
import { can } from '../../../core/authz/policy.ts'
import {
  normalizeQuizTitle,
  quizSlug,
  validateQuiz,
} from '../../../core/quiz/quiz.ts'
import { canCreateArticle, cmsActor } from '../access'
import { deployAfterChange, deployAfterDelete } from '../hooks/deploy-site'

export const canReviewQuiz = ({
  req,
}: Parameters<typeof canCreateArticle>[0]) =>
  can(cmsActor(req.user), 'quiz:manage')

const privateField: FieldAccess = ({ req, doc }) => {
  if (canReviewQuiz({ req })) return true
  if (!req.user) return false
  if (!doc) return false
  const owner = typeof doc.owner === 'object' ? doc.owner?.id : doc.owner
  return String(owner) === String(req.user.id)
}

const ownUnpublished = ({
  req,
}: Parameters<typeof canCreateArticle>[0]): boolean | Where => {
  if (canReviewQuiz({ req })) return true
  if (!canCreateArticle({ req }) || !req.user) return false
  return {
    and: [
      { owner: { equals: req.user.id } },
      { status: { not_equals: 'published' } },
    ],
  }
}

export const Quizzes: CollectionConfig = {
  slug: 'quizzes',
  labels: { singular: 'Quiz', plural: 'Quizzes' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'article', 'updatedAt'],
  },
  access: {
    create: ({ req }) => canCreateArticle({ req }) || canReviewQuiz({ req }),
    read: ({ req }) => {
      if (canReviewQuiz({ req })) return true
      if (canCreateArticle({ req }) && req.user) {
        const where: Where = {
          or: [
            { status: { equals: 'published' } },
            { owner: { equals: req.user.id } },
          ],
        }
        return where
      }
      return { status: { equals: 'published' } }
    },
    update: ownUnpublished,
    delete: ownUnpublished,
  },
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        if (!data) return data
        const title = data.title ?? originalDoc?.title
        if (typeof title !== 'string') return data
        data.title = normalizeQuizTitle(title)
        if (!quizSlug(data.title))
          throw new APIError(
            'Use pelo menos uma letra ou número no título.',
            400,
          )
        data.titleKey = data.title.toLowerCase()
        const existing = await req.payload.find({
          collection: 'quizzes',
          overrideAccess: true,
          req,
          depth: 0,
          pagination: false,
          select: { title: true, titleKey: true },
          where: {
            and: [
              {
                or: [
                  { titleKey: { equals: data.titleKey } },
                  { titleKey: { exists: false } },
                ],
              },
              ...(originalDoc?.id
                ? [{ id: { not_equals: originalDoc.id } }]
                : []),
            ],
          },
        })
        // Existing documents keep their URLs and acquire a normalized key on their next save.
        if (
          existing.docs.some(
            (doc) =>
              normalizeQuizTitle(doc.title).toLowerCase() === data.titleKey,
          )
        )
          throw new APIError(
            'Já existe um quiz com esse nome. Escolha outro título.',
            400,
          )
        if (originalDoc && data.title === originalDoc.title) {
          data.slug = originalDoc.slug
        } else {
          data.slug = quizSlug(data.title)
          const collision = await req.payload.find({
            collection: 'quizzes',
            overrideAccess: true,
            req,
            depth: 0,
            limit: 1,
            where: {
              and: [
                { slug: { equals: data.slug } },
                ...(originalDoc?.id
                  ? [{ id: { not_equals: originalDoc.id } }]
                  : []),
              ],
            },
          })
          if (collision.totalDocs)
            data.slug = `${data.slug.slice(0, 151).replace(/-+$/, '')}-${createHash('sha256').update(data.titleKey).digest('hex').slice(0, 8)}`
        }
        return data
      },
    ],
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        const reviewer = canReviewQuiz({ req })
        // Ownership is server-assigned even when a forged owner is sent through REST.
        data.owner =
          operation === 'create'
            ? req.user?.id
            : (originalDoc?.owner?.id ?? originalDoc?.owner)
        if (!reviewer) {
          if (originalDoc?.status === 'published')
            throw new APIError(
              'Peça à revisão para despublicar o quiz antes de editar.',
              403,
            )
          if (
            data.status &&
            !['draft', 'in_review'].includes(data.status) &&
            data.status !== originalDoc?.status
          )
            throw new APIError(
              'Somente a revisão pode publicar ou solicitar ajustes.',
              403,
            )
        }
        const merged = { ...originalDoc, ...data }
        data.titleKey =
          typeof merged.title === 'string'
            ? normalizeQuizTitle(merged.title).toLowerCase()
            : undefined
        const error = validateQuiz(merged)
        if (error) throw new APIError(error, 400)
        const previousArticle =
          typeof originalDoc?.article === 'object'
            ? originalDoc.article?.id
            : originalDoc?.article
        const nextArticle =
          typeof merged.article === 'object'
            ? merged.article?.id
            : merged.article
        // A quiz editor may review an existing link without gaining access to an article draft.
        if (
          nextArticle &&
          (operation === 'create' ||
            String(nextArticle) !== String(previousArticle))
        ) {
          const id =
            typeof merged.article === 'object'
              ? merged.article.id
              : merged.article
          const article = await req.payload.findByID({
            collection: 'articles',
            id,
            req,
            overrideAccess: false,
            depth: 0,
          })
          const owner =
            typeof article.owner === 'object'
              ? article.owner?.id
              : article.owner
          if (
            !reviewer &&
            article._status !== 'published' &&
            String(owner) !== String(req.user?.id)
          )
            throw new APIError(
              'Escolha um artigo publicado ou um artigo da sua autoria.',
              403,
            )
        }
        return data
      },
    ],
    afterChange: [deployAfterChange],
    afterDelete: [deployAfterDelete],
  },
  fields: [
    {
      name: 'title',
      label: 'Título',
      type: 'text',
      required: true,
      maxLength: 160,
    },
    {
      name: 'slug',
      label: 'Endereço do quiz',
      type: 'text',
      required: true,
      unique: true,
      maxLength: 160,
      admin: { hidden: true },
    },
    {
      name: 'titleKey',
      type: 'text',
      unique: true,
      admin: { hidden: true },
      access: { read: () => false, create: () => false, update: () => false },
    },
    {
      name: 'summary',
      label: 'Resumo',
      type: 'textarea',
      required: true,
      maxLength: 300,
    },
    {
      name: 'article',
      label: 'Artigo relacionado (opcional)',
      type: 'relationship',
      relationTo: 'articles',
      index: true,
      admin: {
        description:
          'Deixe vazio para um quiz independente. O link público aparece quando o artigo também estiver publicado.',
      },
    },
    {
      name: 'owner',
      label: 'Conta autora',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: { position: 'sidebar', readOnly: true },
      access: {
        // Allow owner filters while keeping feedback unavailable as a query oracle.
        read: (args) =>
          !args.doc ? Boolean(args.req.user) : privateField(args),
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'status',
      label: 'Status editorial',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      admin: { position: 'sidebar' },
      options: [
        { label: 'Rascunho', value: 'draft' },
        { label: 'Em revisão', value: 'in_review' },
        { label: 'Ajustes solicitados', value: 'changes_requested' },
        { label: 'Publicado', value: 'published' },
      ],
    },
    {
      name: 'reviewNotes',
      label: 'Devolutiva da revisão',
      type: 'textarea',
      maxLength: 1000,
      admin: { position: 'sidebar' },
      access: {
        read: privateField,
        create: ({ req }) => canReviewQuiz({ req }),
        update: ({ req }) => canReviewQuiz({ req }),
      },
    },
    {
      name: 'questions',
      label: 'Perguntas',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 30,
      fields: [
        {
          name: 'prompt',
          label: 'Enunciado',
          type: 'textarea',
          required: true,
          maxLength: 1000,
        },
        {
          name: 'choices',
          label: 'Alternativas',
          type: 'array',
          required: true,
          minRows: 2,
          maxRows: 6,
          fields: [
            {
              name: 'text',
              label: 'Texto',
              type: 'text',
              required: true,
              maxLength: 300,
            },
          ],
        },
        {
          name: 'correctAnswer',
          label: 'Índice da alternativa correta',
          type: 'number',
          required: true,
          min: 0,
          max: 5,
          admin: {
            description:
              'Começa em zero: 0 = primeira alternativa, 1 = segunda, e assim por diante.',
          },
        },
        {
          name: 'explanation',
          label: 'Explicação da resposta',
          type: 'textarea',
          required: true,
          maxLength: 2000,
        },
      ],
    },
  ],
}
