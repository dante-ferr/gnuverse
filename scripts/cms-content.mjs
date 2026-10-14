export function validateArticle(doc) {
  if (doc._status !== 'published') throw new Error('A API retornou um artigo não publicado.')
  for (const field of ['title', 'slug', 'summary', 'author', 'category']) {
    if (typeof doc[field] !== 'string' || !doc[field].trim()) throw new Error(`Artigo com ${field} inválido.`)
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc.slug)) throw new Error('Slug inválido no CMS.')
  if (!doc.body?.root || !Array.isArray(doc.body.root.children)) throw new Error(`Texto inválido: ${doc.slug}`)
  const references = (doc.references ?? []).map((reference) => {
    const url = new URL(reference.url)
    if (!['https:', 'http:'].includes(url.protocol) || typeof reference.label !== 'string') {
      throw new Error('Referência inválida no CMS.')
    }
    return { label: reference.label, url: url.href }
  })
  return {
    title: doc.title, slug: doc.slug, summary: doc.summary, author: doc.author,
    category: doc.category, body: doc.body, references,
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
      'where[_status][equals]': 'published', depth: '1', limit: '100', page: String(page), sort: '-createdAt',
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
