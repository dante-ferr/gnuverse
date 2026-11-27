import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access'

export const ArticleComments: CollectionConfig = {
  slug: 'article-comments',
  labels: { singular: 'Comentário', plural: 'Comentários' },
  admin: {
    defaultColumns: ['article', 'author', 'createdAt'],
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'article',
      label: 'Artigo',
      type: 'relationship',
      relationTo: 'articles',
      required: true,
      index: true,
    },
    {
      name: 'author',
      label: 'Autor',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'content',
      label: 'Comentário',
      type: 'textarea',
      required: true,
      minLength: 3,
      maxLength: 1000,
    },
  ],
}
