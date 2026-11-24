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

export type SubmissionMedia = {
  id: string | number
  url?: string
  alt?: string
  credit?: string
}

export type SubmissionArticle = {
  id: string | number
  title: string
  slug: string
  summary: string
  author: string
  category?: string
  cover?: string | number | SubmissionMedia | null
  hashtags?: Array<{ tag?: string } | string>
  body?: unknown
  references?: ArticleReference[]
  _status?: 'draft' | 'published'
  reviewStatus?: ReviewStatus
  reviewNotes?: string | null
  updatedAt?: string
}

const MAX_HASHTAGS = 10

/**
 * Converte texto livre de hashtags (separadas por vírgula ou espaço) em uma
 * lista normalizada, única e limitada a 10 itens.
 */
export function parseHashtagsInput(input: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  const tokens = input.split(/[\s,]+/)

  for (const raw of tokens) {
    const cleaned = raw
      .trim()
      .replace(/^#+/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '')

    if (!cleaned || seen.has(cleaned)) continue
    seen.add(cleaned)
    result.push(cleaned)
    if (result.length >= MAX_HASHTAGS) break
  }

  return result
}

/**
 * Formata uma lista de hashtags do CMS ou formulário para edição em texto.
 */
export function formatHashtagsInput(
  tags?: Array<{ tag?: string } | string>,
): string {
  if (!Array.isArray(tags) || tags.length === 0) return ''
  const raw = tags
    .map((item) => (typeof item === 'string' ? item : item?.tag ?? ''))
    .join(' ')
  return parseHashtagsInput(raw)
    .map((tag) => `#${tag}`)
    .join(', ')
}

export function slugifyTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function makeTextNode(text: string, format = 0) {
  return {
    type: 'text',
    version: 1,
    text,
    format,
    detail: 0,
    mode: 'normal',
    style: '',
  }
}

function parseInlineNodes(text: string): Array<Record<string, unknown>> {
  const nodes: Array<Record<string, unknown>> = []
  const tokenPattern =
    /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\((?:https?:\/\/|mailto:|\/|#)[^\s)]+\))/g
  let lastIndex = 0

  for (const match of text.matchAll(tokenPattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      nodes.push(makeTextNode(text.slice(lastIndex, index), 0))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(makeTextNode(token.slice(2, -2), 1))
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(makeTextNode(token.slice(1, -1), 2))
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(makeTextNode(token.slice(1, -1), 16))
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/.exec(token)
      if (linkMatch) {
        nodes.push({
          type: 'link',
          version: 3,
          direction: 'ltr',
          format: '',
          indent: 0,
          fields: {
            linkType: 'custom',
            newTab: linkMatch[2].startsWith('http'),
            url: linkMatch[2],
          },
          children: [makeTextNode(linkMatch[1], 0)],
        })
      } else {
        nodes.push(makeTextNode(token, 0))
      }
    }
    lastIndex = index + token.length
  }

  if (lastIndex < text.length) {
    nodes.push(makeTextNode(text.slice(lastIndex), 0))
  }
  return nodes.length > 0 ? nodes : [makeTextNode(text, 0)]
}

function makeParagraphNode(text: string) {
  return {
    type: 'paragraph',
    version: 1,
    format: '',
    indent: 0,
    direction: 'ltr',
    children: parseInlineNodes(text),
    textFormat: 0,
    textStyle: '',
  }
}

function parseMediaToken(line: string): Record<string, unknown> | null {
  const match = /^!\[([^\]]*)\]\(cms-media:([^)\s]+)\)$/.exec(line.trim())
  if (!match) return null
  const [, , payload] = match
  const [rawId] = payload.split('|')
  const numericId = Number(rawId)
  const value = Number.isInteger(numericId) && String(numericId) === rawId ? numericId : rawId
  return {
    type: 'upload',
    version: 3,
    format: '',
    id: `media-${rawId}`,
    fields: null,
    relationTo: 'media',
    value,
  }
}

/**
 * Converte texto com formatação (Markdown simples + imagens anexadas) em
 * estrutura Lexical esperada pelo Payload CMS.
 */
export function plainTextToLexical(text: string): SerializedEditorState {
  const blocks = text
    .split(/\r?\n\s*\r?\n+/)
    .map((block) => block.trim())
    .filter(Boolean)

  const children: Array<Record<string, unknown>> = []

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (lines.length === 1) {
      const uploadNode = parseMediaToken(lines[0])
      if (uploadNode) {
        children.push(uploadNode)
        continue
      }
      if (lines[0].startsWith('### ')) {
        children.push({
          type: 'heading',
          version: 1,
          tag: 'h3',
          format: '',
          indent: 0,
          direction: 'ltr',
          children: parseInlineNodes(lines[0].slice(4).trim()),
        })
        continue
      }
      if (lines[0].startsWith('## ')) {
        children.push({
          type: 'heading',
          version: 1,
          tag: 'h2',
          format: '',
          indent: 0,
          direction: 'ltr',
          children: parseInlineNodes(lines[0].slice(3).trim()),
        })
        continue
      }
    }

    if (lines.every((line) => line.startsWith('> '))) {
      children.push({
        type: 'quote',
        version: 1,
        format: '',
        indent: 0,
        direction: 'ltr',
        children: parseInlineNodes(lines.map((line) => line.slice(2).trim()).join(' ')),
      })
      continue
    }

    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      children.push({
        type: 'list',
        version: 1,
        listType: 'bullet',
        tag: 'ul',
        start: 1,
        format: '',
        indent: 0,
        direction: 'ltr',
        children: lines.map((line, index) => ({
          type: 'listitem',
          version: 1,
          value: index + 1,
          format: '',
          indent: 0,
          direction: 'ltr',
          children: parseInlineNodes(line.replace(/^[-*]\s+/, '').trim()),
        })),
      })
      continue
    }

    if (lines.every((line) => /^\d+\.\s+/.test(line))) {
      children.push({
        type: 'list',
        version: 1,
        listType: 'number',
        tag: 'ol',
        start: 1,
        format: '',
        indent: 0,
        direction: 'ltr',
        children: lines.map((line, index) => ({
          type: 'listitem',
          version: 1,
          value: index + 1,
          format: '',
          indent: 0,
          direction: 'ltr',
          children: parseInlineNodes(line.replace(/^\d+\.\s+/, '').trim()),
        })),
      })
      continue
    }

    children.push(makeParagraphNode(lines.join(' ')))
  }

  return {
    root: {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: 'ltr',
      children,
    },
  } as unknown as SerializedEditorState
}

function extractInlineText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const record = node as Record<string, unknown>
  if (record.type === 'linebreak') return '\n'
  if (typeof record.text === 'string') {
    const format = typeof record.format === 'number' ? record.format : 0
    let text = record.text
    if (format & 16) text = `\`${text}\``
    if (format & 1) text = `**${text}**`
    else if (format & 2) text = `*${text}*`
    return text
  }
  if (record.type === 'link' || record.type === 'autolink') {
    const fields = record.fields as Record<string, unknown> | undefined
    const url = typeof fields?.url === 'string' ? fields.url : ''
    const label = Array.isArray(record.children)
      ? record.children.map(extractInlineText).join('')
      : url
    return url ? `[${label}](${url})` : label
  }
  if (!Array.isArray(record.children)) return ''
  return record.children.map(extractInlineText).join('')
}

function extractNodeText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const record = node as Record<string, unknown>
  if (record.type === 'upload' && record.relationTo === 'media') {
    const value = record.value as Record<string, unknown> | string | number | undefined
    if (value && typeof value === 'object') {
      const id = String(value.id ?? '')
      const alt = typeof value.alt === 'string' ? value.alt : 'Imagem'
      const url = typeof value.url === 'string' ? value.url : ''
      return id ? `![${alt}](cms-media:${id}${url ? `|${url}` : ''})` : ''
    }
    return value ? `![Imagem](cms-media:${value})` : ''
  }
  if (record.type === 'heading') {
    const prefix = record.tag === 'h3' ? '### ' : '## '
    const text = Array.isArray(record.children)
      ? record.children.map(extractInlineText).join('').trim()
      : ''
    return text ? `${prefix}${text}` : ''
  }
  if (record.type === 'quote') {
    const text = Array.isArray(record.children)
      ? record.children.map(extractInlineText).join('').trim()
      : ''
    return text ? `> ${text}` : ''
  }
  if (record.type === 'list' && Array.isArray(record.children)) {
    const ordered = record.listType === 'number' || record.tag === 'ol'
    return record.children
      .map((item, index) => {
        const text = extractInlineText(item).trim()
        return text ? `${ordered ? `${index + 1}.` : '-'} ${text}` : ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return extractInlineText(record)
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
  category?: string
  hashtags: string[]
  bodyText: string
  references: ArticleReference[]
}

export type ValidatedSubmission = {
  title: string
  slug: string
  summary: string
  author: string
  category: string
  hashtags: string[]
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
  const rawCategory = (input.category ?? '').trim()
  const category = rawCategory && Object.hasOwn(categoryNames, rawCategory) ? rawCategory : 'reflexoes'

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
  if (!author) return { ok: false, error: 'Não foi possível identificar a autoria da conta.' }

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

  const hashtags = parseHashtagsInput(
    Array.isArray(input.hashtags) ? input.hashtags.join(' ') : '',
  )

  return {
    ok: true,
    data: { title, slug, summary, author, category, hashtags, body, references },
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
  if (status === 401) return 'E-mail, apelido ou senha inválidos, ou sessão expirada.'
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
      return 'A solicitação demorou mais que o esperado. Tente novamente em instantes.'
    }
    if (cause instanceof TypeError) {
      return 'Não foi possível concluir a conexão no momento. Aguarde alguns segundos e tente novamente.'
    }
    return cause.message
  }
  return 'Erro inesperado ao enviar a solicitação.'
}
