import path from 'node:path'
import type { CollectionConfig } from 'payload'
import { isAdmin, isEditor } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Imagem', plural: 'Imagens' },
  access: { read: () => true, create: isEditor, update: isEditor, delete: isAdmin },
  upload: {
    staticDir: path.resolve('media'),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    imageSizes: [{ name: 'card', width: 1200, height: 800, fit: 'inside', withoutEnlargement: true }],
  },
  fields: [
    { name: 'alt', label: 'Descrição para acessibilidade', type: 'text', required: true },
    { name: 'credit', label: 'Autoria / licença', type: 'text', required: true },
  ],
}
