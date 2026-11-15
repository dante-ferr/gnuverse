import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

export type ArticleReference = {
  label: string
  url: string
}

export type Article = {
  title: string
  slug: string
  summary: string
  author: string
  category: string
  body: SerializedEditorState
  references: ArticleReference[]
  cover?: { url: string; alt: string; credit: string }
}

export const categoryNames: Record<string, string> = {
  reflexoes: 'Reflexões',
  educacao: 'Educação',
  acesso: 'Acesso',
  experiencias: 'Experiências',
}
