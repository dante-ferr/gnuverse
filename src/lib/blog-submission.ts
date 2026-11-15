import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { categoryNames, type ArticleReference } from './article-meta.ts'

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type ReviewStatus =
  | 'draft'
  | 'in_review'
  | 'changes_requested'
  | 'approved'

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: 'Rascunho',
  in_review: 'Em revisão',
  changes_requested: 'Ajustes solicitados',
  approved: 'Aprovado',
}

export type SubmissionArticle = {
  id: string | number
  title: string
  slug: string
  summary: string
  author: string
  category: string
  body?: unknown
  references?: ArticleReference[]
  _status?: 'draft' | 'published'
  reviewStatus?: ReviewStatus
  reviewNotes?: string | null
  updatedAt?: string
}

export function slugifyTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Converte parágrafos separados por linhas em branco para o formato Lexical
 * esperado pelo campo richText do Payload CMS.
 */
export function plainTextToLexical(text: string): SerializedEditorState {
  const paragraphs = text
    .split(/\r?\n\s*\r?\n+/)
    .map((block) => block.replace(/\s*\r?\n\s*/g, ' ').trim())
    .filter(Boolean)

  return {
    root: {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: 'ltr',
      children: paragraphs.map((paragraph) => ({
        type: 'paragraph',
        version: 1,
        format: '',
        indent: 0,
        direction: 'ltr',
        children: [
          {
            type: 'text',
            version: 1,
            text: paragraph,
            format: 0,
            detail: 0,
            mode: 'normal',
            style: '',
          },
        ],
        textFormat: 0,
        textStyle: '',
      })),
    },
  } as unknown as SerializedEditorState
}

function extractNodeText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const record = node as Record<string, unknown>
  if (record.type === 'linebreak') return '\n'
  if (typeof record.text === 'string') return record.text
  if (!Array.isArray(record.children)) return ''
  const joiner = record.type === 'list' ? '\n' : ''
  return record.children.map(extractNodeText).join(joiner)
}

export function lexicalToPlainText(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const root = (body as { root?: { children?: unknown[] } }).root
  if (!root || !Array.isArray(root.children)) return ''
  return root.children
    .map((child) => extractNodeText(child).trim())
    .filter(Boolean)
    .join('\n\n')
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function canAuthorEditSubmission(
  doc: Pick<SubmissionArticle, '_status' | 'reviewStatus'>,
): boolean {
  if (doc._status === 'published') return false
  return (
    !doc.reviewStatus ||
    doc.reviewStatus === 'draft' ||
    doc.reviewStatus === 'changes_requested'
  )
}

export type SubmissionFormValues = {
  title: string
  slug: string
  summary: string
  author: string
  category: string
  bodyText: string
  references: ArticleReference[]
}

export type ValidatedSubmission = {
  title: string
  slug: string
  summary: string
  author: string
  category: string
  body: SerializedEditorState
  references: ArticleReference[]
}

export function validateSubmissionInput(
  input: SubmissionFormValues,
): { ok: true; data: ValidatedSubmission } | { ok: false; error: string } {
  const title = input.title.trim()
  const slug = input.slug.trim()
  const summary = input.summary.trim()
  const author = input.author.trim()
  const category = input.category.trim()

  if (!title) return { ok: false, error: 'Informe o título do artigo.' }
  if (!slug || !SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error:
        'O slug deve usar apenas letras minúsculas, números e hífens entre palavras (ex.: software-livre-na-escola).',
    }
  }
  if (!summary) return { ok: false, error: 'Informe o resumo do artigo.' }
  if (summary.length > 300) {
    return { ok: false, error: 'O resumo pode ter no máximo 300 caracteres.' }
  }
  if (!author) return { ok: false, error: 'Informe o nome da autoria exibida.' }
  if (!Object.hasOwn(categoryNames, category)) {
    return { ok: false, error: 'Escolha uma categoria válida.' }
  }

  const body = plainTextToLexical(input.bodyText)
  if (body.root.children.length === 0) {
    return { ok: false, error: 'Escreva ao menos um parágrafo no texto.' }
  }

  const references: ArticleReference[] = []
  for (const row of input.references) {
    const label = row.label.trim()
    const url = row.url.trim()
    if (!label && !url) continue
    if (!label || !url) {
      return {
        ok: false,
        error: 'Preencha título e link para cada referência adicionada.',
      }
    }
    if (!isValidHttpUrl(url)) {
      return {
        ok: false,
        error: `Link inválido nas referências: ${url}. Use HTTP ou HTTPS.`,
      }
    }
    references.push({ label, url })
  }

  return {
    ok: true,
    data: { title, slug, summary, author, category, body, references },
  }
}

export function extractCmsErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (Array.isArray(record.errors) && record.errors.length > 0) {
      const first = record.errors[0] as Record<string, unknown> | undefined
      const nested = (first?.data as Record<string, unknown> | undefined)?.errors
      if (Array.isArray(nested) && nested.length > 0) {
        const firstNested = nested[0] as Record<string, unknown> | undefined
        if (typeof firstNested?.message === 'string' && firstNested.message.trim()) {
          return firstNested.message
        }
      }
      if (typeof first?.message === 'string' && first.message.trim()) {
        return first.message
      }
    }
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message
    }
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error
    }
  }
  if (status === 401) return 'E-mail ou senha inválidos, ou sessão expirada.'
  if (status === 403) return 'Você não tem permissão para realizar esta ação.'
  if (status === 404) return 'Artigo ou recurso não encontrado no CMS.'
  if (status >= 500) {
    return 'O servidor do CMS encontrou um erro interno. Tente novamente em instantes.'
  }
  return `Não foi possível concluir a requisição (HTTP ${status}).`
}

export function formatRequestFailure(cause: unknown): string {
  if (cause instanceof Error) {
    if (cause.name === 'TimeoutError' || cause.name === 'AbortError') {
      return 'O CMS demorou mais de 2 minutos para responder (no plano gratuito do Render ele pode estar despertando). Tente novamente em instantes.'
    }
    if (cause instanceof TypeError) {
      return 'Não foi possível conectar ao CMS. Se o servidor no Render Free estiver despertando, aguarde alguns segundos e tente novamente.'
    }
    return cause.message
  }
  return 'Erro inesperado ao comunicar com o CMS.'
}
