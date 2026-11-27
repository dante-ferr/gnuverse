import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access'

export const ArticleLikes: CollectionConfig = {
  slug: 'article-likes',
  labels: { singular: 'Curtida de artigo', plural: 'Curtidas de artigos' },
  admin: {
    hidden: true,
    defaultColumns: ['article', 'user', 'createdAt'],
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
      name: 'user',
      label: 'Usuário',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'likeKey',
      label: 'Chave única',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
  ],
}
