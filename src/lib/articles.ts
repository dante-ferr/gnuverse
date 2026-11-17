import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { cache } from 'react'
import { categoryNames, type Article } from './article-meta'

export { categoryNames, type Article }

export const getContent = cache(
  async (): Promise<{ mode: 'demo' | 'live'; articles: Article[] }> => {
    try {
      return JSON.parse(
        await readFile(path.join(process.cwd(), '.content/articles.json'), 'utf8'),
      )
    } catch {
      throw new Error(
        'Conteúdo não preparado. Execute npm run content:sync antes de iniciar ou compilar o site.',
      )
    }
  },
)
