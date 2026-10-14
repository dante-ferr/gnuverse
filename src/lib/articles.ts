import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { cache } from 'react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

export type Article = {
  title: string
  slug: string
  summary: string
  author: string
  category: string
  body: SerializedEditorState
  references: { label: string; url: string }[]
  cover?: { url: string; alt: string; credit: string }
}

export const categoryNames: Record<string, string> = {
  reflexoes: 'Reflexões', educacao: 'Educação', acesso: 'Acesso', experiencias: 'Experiências',
}

export const getContent = cache(async (): Promise<{ mode: 'demo' | 'live'; articles: Article[] }> => {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), '.content/articles.json'), 'utf8'))
  } catch {
    throw new Error('Conteúdo não preparado. Execute npm run content:sync antes de iniciar ou compilar o site.')
  }
})
