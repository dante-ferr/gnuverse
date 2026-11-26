import { createHash } from 'node:crypto'
import { fail } from '../domain/validation.ts'
import { resolveCMSBaseURL } from '../config/runtime-env.ts'

export type CatalogQuiz = {
  slug: string
  questions: { prompt: string; correctAnswer: number; choiceCount: number }[]
}

/** Published learning content the reward service verifies claims against. */
export interface ContentCatalog {
  hasArticle(slug: string): Promise<boolean>
  quiz(slug: string): Promise<CatalogQuiz | null>
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function validSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 200 && SLUG.test(value)
}

/** Stable per-question id: survives reordering, changes when the prompt changes. */
export function questionKey(prompt: string) {
  return createHash('sha256').update(prompt.normalize('NFC').trim()).digest('hex').slice(0, 12)
}

/** Reads the CMS public API. Anonymous requests only ever see published content. */
export class CMSContentCatalog implements ContentCatalog {
  private base: string
  constructor(base = resolveCMSBaseURL()) {
    this.base = base.replace(/\/$/, '')
  }
  private async first(collection: string, statusField: string, slug: string) {
    const query = new URLSearchParams({
      'where[slug][equals]': slug,
      [`where[${statusField}][equals]`]: 'published',
      depth: '0',
      limit: '1',
    })
    let response: Response
    try {
      response = await fetch(`${this.base}/api/${collection}?${query}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      fail(503, 'O conteúdo não está disponível agora. Tente novamente em instantes.')
    }
    if (!response.ok) fail(503, 'O conteúdo não está disponível agora. Tente novamente em instantes.')
    const data = (await response.json().catch(() => null)) as { docs?: unknown[] } | null
    return (Array.isArray(data?.docs) ? data.docs[0] : undefined) as Record<string, unknown> | undefined
  }
  async hasArticle(slug: string) {
    return Boolean(await this.first('articles', '_status', slug))
  }
  async quiz(slug: string): Promise<CatalogQuiz | null> {
    const doc = await this.first('quizzes', 'status', slug)
    if (!doc || !Array.isArray(doc.questions)) return null
    const questions = (doc.questions as Record<string, unknown>[]).map((question) => ({
      prompt: String(question.prompt ?? ''),
      correctAnswer: Number(question.correctAnswer),
      choiceCount: Array.isArray(question.choices) ? question.choices.length : 0,
    }))
    return { slug, questions }
  }
}
