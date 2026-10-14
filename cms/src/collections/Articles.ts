import type { CollectionConfig } from 'payload'
import { isEditor, publishedOrEditor } from '../access'
import { deployAfterChange, deployAfterDelete } from '../hooks/deploy-site'

export const Articles: CollectionConfig = {
  slug: 'articles',
  labels: { singular: 'Artigo', plural: 'Artigos' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'author', '_status', 'updatedAt'] },
  access: { read: publishedOrEditor, readVersions: isEditor, create: isEditor, update: isEditor, delete: isEditor },
  versions: { drafts: true, maxPerDoc: 20 },
  hooks: { afterChange: [deployAfterChange], afterDelete: [deployAfterDelete] },
  fields: [
    { name: 'title', label: 'Título', type: 'text', required: true },
    {
      name: 'slug', label: 'Endereço do artigo', type: 'text', required: true, unique: true, index: true,
      admin: { description: 'Use letras minúsculas, números e hífens. Exemplo: tecnologia-para-mais-gente' },
      validate: (value: unknown) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || 'Use apenas letras minúsculas, números e hífens entre palavras.',
    },
    { name: 'summary', label: 'Resumo', type: 'textarea', required: true, maxLength: 300 },
    { name: 'author', label: 'Autoria', type: 'text', required: true },
    { name: 'category', label: 'Categoria', type: 'select', required: true, defaultValue: 'reflexoes', options: [
      { label: 'Reflexões', value: 'reflexoes' },
      { label: 'Educação', value: 'educacao' },
      { label: 'Acesso', value: 'acesso' },
      { label: 'Experiências', value: 'experiencias' },
    ] },
    { name: 'cover', label: 'Imagem de capa (opcional)', type: 'upload', relationTo: 'media' },
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
