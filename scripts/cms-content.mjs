function isSafeBodyHref(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if ((trimmed.startsWith('/') && !trimmed.startsWith('//')) || trimmed.startsWith('#')) {
    return true
  }
  try {
    const parsed = new URL(trimmed)
    return ['https:', 'http:', 'mailto:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

function validateLexicalNodes(node) {
  if (!node || typeof node !== 'object') return
  if (node.type === 'upload' || node.type === 'relationship') {
    throw new Error('Bloco de mídia ou relação não permitido no corpo do artigo.')
  }
  if (node.type === 'link' || node.type === 'autolink') {
    const rawUrl = node.fields?.url ?? node.url
    if (!isSafeBodyHref(rawUrl)) {
      throw new Error('Link inválido no corpo do artigo.')
    }
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) validateLexicalNodes(child)
  }
}

export function validateArticle(doc) {
  if (doc._status !== 'published') throw new Error('A API retornou um artigo não publicado.')
  for (const field of ['title', 'slug', 'summary', 'author', 'category']) {
    if (typeof doc[field] !== 'string' || !doc[field].trim()) throw new Error(`Artigo com ${field} inválido.`)
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc.slug)) throw new Error('Slug inválido no CMS.')
  if (!doc.body?.root || !Array.isArray(doc.body.root.children)) throw new Error(`Texto inválido: ${doc.slug}`)
  validateLexicalNodes(doc.body.root)
  const references = (doc.references ?? []).map((reference) => {
    const url = new URL(reference.url)
    if (!['https:', 'http:'].includes(url.protocol) || typeof reference.label !== 'string') {
      throw new Error('Referência inválida no CMS.')
    }
    return { label: reference.label, url: url.href }
  })

  const hashtagSet = new Set()
  const hashtags = []
  if (Array.isArray(doc.hashtags)) {
    for (const item of doc.hashtags) {
      const rawTag = typeof item === 'string' ? item : item && typeof item.tag === 'string' ? item.tag : ''
      const normalized = rawTag
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^#+/, '')
        .toLowerCase()
      if (!/^[a-z0-9][a-z0-9-_]{0,39}$/.test(normalized) || hashtagSet.has(normalized)) continue
      hashtagSet.add(normalized)
      hashtags.push(normalized)
      if (hashtags.length >= 10) break
    }
  }

  const rawPublishedAt = [doc.publishedAt, doc.createdAt, doc.updatedAt].find(
    (value) => typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Date.parse(value)),
  )
  const publishedAt = typeof rawPublishedAt === 'string' ? rawPublishedAt.trim() : undefined

  return {
    title: doc.title, slug: doc.slug, summary: doc.summary, author: doc.author,
    category: doc.category, body: doc.body, references,
    hashtags,
    publishedAt,
    cover: doc.cover && typeof doc.cover === 'object' ? doc.cover : undefined,
  }
}

export async function fetchPublishedArticles(baseURL, fetcher = fetch) {
  const base = new URL(baseURL)
  if (!['https:', 'http:'].includes(base.protocol)) throw new Error('CMS_URL precisa ser HTTP ou HTTPS.')
  const articles = []
  const slugs = new Set()
  let page = 1
  while (true) {
    const url = new URL('/api/articles', base)
    url.search = new URLSearchParams({
      'where[_status][equals]': 'published', depth: '1', limit: '100', page: String(page), sort: '-publishedAt,-createdAt',
    }).toString()
    const response = await fetcher(url, { signal: AbortSignal.timeout(120000) })
    if (!response.ok) throw new Error(`CMS indisponível (HTTP ${response.status}). A versão anterior do site deve ser preservada.`)
    const data = await response.json()
    if (!Array.isArray(data.docs)) throw new Error('Resposta inválida do CMS.')
    for (const doc of data.docs) {
      const article = validateArticle(doc)
      if (slugs.has(article.slug)) throw new Error('O CMS retornou slugs duplicados.')
      slugs.add(article.slug)
      articles.push(article)
    }
    if (!data.hasNextPage) return articles
    if (page++ >= 100) throw new Error('Limite de paginação excedido no CMS.')
  }
}
