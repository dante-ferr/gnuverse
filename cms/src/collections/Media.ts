import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CollectionConfig } from 'payload'
import { canCreateArticle, isAdmin, isReviewer } from '../access'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Imagem', plural: 'Imagens' },
  access: { read: () => true, create: canCreateArticle, update: isReviewer, delete: isAdmin },
  upload: {
    staticDir: process.env.MEDIA_DIR
      ? path.resolve(process.env.MEDIA_DIR)
      : path.resolve(dirname, '../../media'),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    imageSizes: [{ name: 'card', width: 1200, height: 800, fit: 'inside', withoutEnlargement: true }],
  },
  fields: [
    { name: 'alt', label: 'Descrição para acessibilidade', type: 'text', required: true },
    { name: 'credit', label: 'Autoria / licença', type: 'text', required: true },
  ],
}
