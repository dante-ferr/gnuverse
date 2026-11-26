'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BLOG_PAGE_SIZE, type Article } from '@/lib/article-meta'
import {
  filterAndSortArticles,
  formatArticleDate,
  getBlogPageHref,
  hasActiveExplorerFilters,
  paginateArticles,
  type SortOrder,
  type ViewMode,
} from '@/lib/blog-explorer'

export type BlogExplorerProps = {
  articles: Article[]
  mode: 'demo' | 'live'
  currentPage?: number
  basePath?: string
}

function GridIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      suppressHydrationWarning
    >
      <rect x="2" y="2" width="5" height="5" rx="0.75" />
      <rect x="9" y="2" width="5" height="5" rx="0.75" />
      <rect x="2" y="9" width="5" height="5" rx="0.75" />
      <rect x="9" y="9" width="5" height="5" rx="0.75" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      suppressHydrationWarning
    >
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
    </svg>
  )
}

function ThumbnailFallback() {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[var(--surface-raised)]"
    >
      <svg
        className="absolute inset-0 h-full w-full opacity-45"
        viewBox="0 0 320 180"
        preserveAspectRatio="none"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
      >
        <path d="M0 45H320M0 90H320M0 135H320M64 0V180M128 0V180M192 0V180M256 0V180" />
      </svg>
      <img
        src="/gnuverse-logo.svg"
        alt=""
        width={42}
        height={42}
        decoding="async"
        className="relative z-10 h-11 w-11 opacity-20"
      />
    </div>
  )
}

function ArticleMetadata({ article }: { article: Article }) {
  const formattedDate = formatArticleDate(article.publishedAt)
  const hashtags = article.hashtags ?? []

  return (
    <div className="mt-auto pt-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
        <span>{article.author}</span>
        {formattedDate && (
          <>
            <span aria-hidden="true">·</span>
            <time dateTime={article.publishedAt} className="tabular-nums">
              {formattedDate}
            </time>
          </>
        )}
      </div>

      {hashtags.length > 0 && (
        <ul aria-label="Hashtags" className="mt-3 flex flex-wrap gap-1.5">
          {hashtags.map((tag) => (
            <li
              key={tag}
              className="rounded-md border border-[var(--line)] bg-[var(--background)] px-2 py-0.5 text-[11px] text-[var(--muted)]"
            >
              <span className="text-[var(--secondary)]">#</span>
              {tag}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function BlogExplorer({
  articles,
  mode,
  currentPage = 1,
  basePath,
}: BlogExplorerProps) {
  const [query, setQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [clientPage, setClientPage] = useState(1)

  const isFiltered = hasActiveExplorerFilters({
    query,
    sort: sortOrder,
  })

  const filteredArticles = useMemo(
    () =>
      filterAndSortArticles(articles, {
        query,
        sort: sortOrder,
      }),
    [articles, query, sortOrder],
  )

  const useStaticLinks = Boolean(basePath) && !isFiltered
  const requestedPage = useStaticLinks ? currentPage : clientPage

  const pagination = useMemo(
    () => paginateArticles(filteredArticles, requestedPage, BLOG_PAGE_SIZE),
    [filteredArticles, requestedPage],
  )

  const showFeatured =
    viewMode === 'grid' &&
    !query.trim() &&
    pagination.currentPage === 1 &&
    pagination.items.length > 0

  const featuredArticle = showFeatured ? pagination.items[0] : null
  const remainingArticles = showFeatured
    ? pagination.items.slice(1)
    : pagination.items

  function clearAllFilters() {
    setQuery('')
    setSortOrder('recent')
    setClientPage(1)
  }

  const controlClass =
    'h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] transition hover:border-[var(--muted)] focus:border-[var(--accent)] focus:outline-none'

  return (
    <section aria-label="Explorar artigos" className="mt-10">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] pb-6">
        <div className="min-w-0 flex-1 basis-60">
          <label htmlFor="blog-search" className="sr-only">
            Buscar artigos
          </label>
          <input
            id="blog-search"
            type="search"
            aria-label="Buscar artigos"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setClientPage(1)
            }}
            placeholder="Buscar por título, resumo, autoria ou #hashtag…"
            className={`w-full ${controlClass}`}
          />
        </div>

        <div className="shrink-0">
          <label htmlFor="blog-sort-order" className="sr-only">
            Ordenar por data
          </label>
          <select
            id="blog-sort-order"
            aria-label="Ordenar por data"
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value as SortOrder)
              setClientPage(1)
            }}
            className={controlClass}
          >
            <option value="recent">Data: Mais recentes</option>
            <option value="oldest">Data: Mais antigos</option>
          </select>
        </div>

        <div
          role="group"
          aria-label="Modo de visualização"
          className="flex shrink-0 items-center gap-1.5"
        >
          <button
            type="button"
            aria-label="Visualização em grade"
            aria-pressed={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
            className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border transition ${
              viewMode === 'grid'
                ? 'border-[var(--muted)] bg-[var(--surface-raised)] text-[var(--accent)]'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <GridIcon />
          </button>
          <button
            type="button"
            aria-label="Visualização em lista"
            aria-pressed={viewMode === 'list'}
            onClick={() => setViewMode('list')}
            className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border transition ${
              viewMode === 'list'
                ? 'border-[var(--muted)] bg-[var(--surface-raised)] text-[var(--accent)]'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <ListIcon />
          </button>
        </div>
      </div>

      {pagination.items.length > 0 ? (
        <div className="mt-8">
          {featuredArticle && (
            <article className="article-card group relative grid grid-cols-1 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] transition-colors hover:border-[var(--muted)] focus-within:border-[var(--accent)] lg:grid-cols-[11fr_9fr]">
              <div className="relative aspect-video w-full overflow-hidden border-b border-[var(--line)] bg-[var(--surface-raised)] lg:h-full lg:border-r lg:border-b-0">
                {featuredArticle.cover ? (
                  <img
                    src={featuredArticle.cover.url}
                    alt={featuredArticle.cover.alt}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ThumbnailFallback />
                )}
              </div>

              <div className="flex flex-col p-6 sm:p-7">
                <p className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-[var(--secondary)]">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-[var(--secondary)]"
                  />
                  Em destaque
                </p>
                <h2 className="text-2xl font-semibold leading-tight tracking-tight text-[var(--ink)] sm:text-3xl">
                  <Link
                    href={`/artigos/${featuredArticle.slug}/`}
                    className="after:absolute after:inset-0 after:content-[''] group-hover:text-[var(--accent)] focus:outline-none"
                  >
                    {featuredArticle.title}
                  </Link>
                </h2>

                <p className="mt-3 line-clamp-3 text-base leading-relaxed text-[var(--muted)]">
                  {featuredArticle.summary}
                </p>

                <ArticleMetadata article={featuredArticle} />
              </div>
            </article>
          )}

          {remainingArticles.length > 0 && (
            <div
              className={
                viewMode === 'grid'
                  ? `${featuredArticle ? 'mt-6 ' : ''}grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3`
                  : 'flex flex-col gap-5'
              }
            >
              {remainingArticles.map((article) => (
                <article
                  key={article.slug}
                  className={`article-card group relative overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] transition-colors hover:border-[var(--muted)] focus-within:border-[var(--accent)] ${
                    viewMode === 'list'
                      ? 'flex flex-col sm:flex-row'
                      : 'flex flex-col'
                  }`}
                >
                  <div
                    className={`relative aspect-video overflow-hidden bg-[var(--surface-raised)] ${
                      viewMode === 'list'
                        ? 'w-full border-b border-[var(--line)] sm:w-64 sm:shrink-0 sm:border-r sm:border-b-0'
                        : 'w-full border-b border-[var(--line)]'
                    }`}
                  >
                    {article.cover ? (
                      <img
                        src={article.cover.url}
                        alt={article.cover.alt}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ThumbnailFallback />
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="text-lg font-semibold leading-snug tracking-tight text-[var(--ink)]">
                      <Link
                        href={`/artigos/${article.slug}/`}
                        className="after:absolute after:inset-0 after:content-[''] group-hover:text-[var(--accent)] focus:outline-none"
                      >
                        {article.title}
                      </Link>
                    </h2>

                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
                      {article.summary}
                    </p>

                    <ArticleMetadata article={article} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : articles.length === 0 ? (
        <p className="mt-10 rounded-md border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          {mode === 'demo'
            ? 'Nenhum artigo de demonstração disponível no momento.'
            : 'Os primeiros artigos estão em preparação e aparecerão aqui após publicação.'}
        </p>
      ) : (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-md border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          <p>Nenhum artigo encontrado com os filtros selecionados.</p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="cursor-pointer rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-3.5 py-2 text-xs font-medium text-[var(--ink)] transition hover:border-[var(--muted)]"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <nav
          aria-label="Paginação do blog"
          className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-6 text-sm"
        >
          {useStaticLinks && basePath ? (
            <>
              {pagination.currentPage > 1 ? (
                <Link
                  href={getBlogPageHref(pagination.currentPage - 1, basePath)}
                  className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[var(--ink)] transition hover:border-[var(--muted)] hover:bg-[var(--surface-raised)]"
                >
                  ← Anterior
                </Link>
              ) : (
                <span className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[var(--muted)] opacity-50">
                  ← Anterior
                </span>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                {Array.from(
                  { length: pagination.totalPages },
                  (_, index) => index + 1,
                ).map((pageNumber) => {
                  const active = pageNumber === pagination.currentPage
                  return (
                    <Link
                      key={pageNumber}
                      href={getBlogPageHref(pageNumber, basePath)}
                      aria-current={active ? 'page' : undefined}
                      className={`rounded-md border px-3 py-1.5 tabular-nums transition ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent)] font-medium text-[var(--on-accent)]'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {pageNumber}
                    </Link>
                  )
                })}
              </div>

              {pagination.currentPage < pagination.totalPages ? (
                <Link
                  href={getBlogPageHref(pagination.currentPage + 1, basePath)}
                  className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[var(--ink)] transition hover:border-[var(--muted)] hover:bg-[var(--surface-raised)]"
                >
                  Próxima →
                </Link>
              ) : (
                <span className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[var(--muted)] opacity-50">
                  Próxima →
                </span>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={pagination.currentPage <= 1}
                onClick={() =>
                  setClientPage((page) => Math.max(1, page - 1))
                }
                className="cursor-pointer rounded-md border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[var(--ink)] transition hover:border-[var(--muted)] hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← Anterior
              </button>

              <div className="flex flex-wrap items-center gap-1.5">
                {Array.from(
                  { length: pagination.totalPages },
                  (_, index) => index + 1,
                ).map((pageNumber) => {
                  const active = pageNumber === pagination.currentPage
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setClientPage(pageNumber)}
                      className={`cursor-pointer rounded-md border px-3 py-1.5 tabular-nums transition ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent)] font-medium text-[var(--on-accent)]'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                disabled={pagination.currentPage >= pagination.totalPages}
                onClick={() =>
                  setClientPage((page) =>
                    Math.min(pagination.totalPages, page + 1),
                  )
                }
                className="cursor-pointer rounded-md border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[var(--ink)] transition hover:border-[var(--muted)] hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Próxima →
              </button>
            </>
          )}
        </nav>
      )}
    </section>
  )
}
