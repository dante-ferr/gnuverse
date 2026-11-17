import { BLOG_PAGE_SIZE, type Article } from './article-meta.ts'

export type SortOrder = 'recent' | 'oldest'
export type ViewMode = 'grid' | 'list'

export type BlogFilterOptions = {
  query: string
  sort: SortOrder
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function formatArticleDate(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
  }).format(date)
}

export function hasActiveExplorerFilters(options: BlogFilterOptions): boolean {
  return options.query.trim() !== '' || options.sort !== 'recent'
}

function parseTimestamp(value?: string): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

function matchesQuery(article: Article, rawQuery: string): boolean {
  const normalized = normalizeSearchText(rawQuery)
  if (!normalized) return true

  const hashtagQuery = normalized.replace(/^#+/, '')
  const tags = (article.hashtags ?? []).map((tag) =>
    normalizeSearchText(tag).replace(/^#+/, ''),
  )

  if (normalized.startsWith('#')) {
    return hashtagQuery.length > 0 && tags.some((tag) => tag.includes(hashtagQuery))
  }

  const fields = [article.title, article.summary, article.author]
  if (fields.some((field) => normalizeSearchText(field).includes(normalized))) {
    return true
  }

  return tags.some((tag) => tag.includes(hashtagQuery))
}

export function filterAndSortArticles(
  articles: Article[],
  options: BlogFilterOptions,
): Article[] {
  const filtered = articles.filter((article) => matchesQuery(article, options.query))

  const hasAnyTimestamp = filtered.some(
    (article) => parseTimestamp(article.publishedAt) !== null,
  )
  if (!hasAnyTimestamp) {
    return options.sort === 'oldest' ? [...filtered].reverse() : [...filtered]
  }

  const direction = options.sort === 'oldest' ? 1 : -1
  return [...filtered].sort((a, b) => {
    const msA = parseTimestamp(a.publishedAt)
    const msB = parseTimestamp(b.publishedAt)
    if (msA === null && msB === null) return 0
    if (msA === null) return 1
    if (msB === null) return -1
    return (msA - msB) * direction
  })
}

export function paginateArticles<T>(
  items: T[],
  page: number,
  pageSize = BLOG_PAGE_SIZE,
): {
  items: T[]
  currentPage: number
  totalPages: number
  totalItems: number
} {
  const safePageSize = Math.max(1, pageSize)
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize))
  const currentPage = Math.min(
    Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1),
    totalPages,
  )
  const start = (currentPage - 1) * safePageSize
  return {
    items: items.slice(start, start + safePageSize),
    currentPage,
    totalPages,
    totalItems: items.length,
  }
}

export function getBlogPageHref(page: number, basePath = '/blog'): string {
  const cleanBase = basePath.replace(/\/+$/, '')
  if (page <= 1) return `${cleanBase}/`
  return `${cleanBase}/pagina/${page}/`
}
