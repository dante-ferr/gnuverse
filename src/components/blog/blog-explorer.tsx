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

  function clearAllFilters() {
    setQuery('')
    setSortOrder('recent')
    setClientPage(1)
  }

  const controlClass =
    'rounded-sm border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none'

  return (
    <section aria-label="Explorar artigos" className="mt-10">
      <div className="flex flex-wrap items-center gap-2.5 rounded-sm border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="min-w-0 flex-1 basis-56">
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
          className="flex shrink-0 items-center gap-1"
        >
          <button
            type="button"
            aria-label="Visualização em grade"
            aria-pressed={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
            className={`cursor-pointer rounded-sm border p-2 transition ${
              viewMode === 'grid'
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]'
                : 'border-[var(--line)] bg-[var(--background)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]'
            }`}
          >
            <GridIcon />
          </button>
          <button
            type="button"
            aria-label="Visualização em lista"
            aria-pressed={viewMode === 'list'}
            onClick={() => setViewMode('list')}
            className={`cursor-pointer rounded-sm border p-2 transition ${
              viewMode === 'list'
                ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]'
                : 'border-[var(--line)] bg-[var(--background)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]'
            }`}
          >
            <ListIcon />
          </button>
        </div>
      </div>

      {pagination.items.length > 0 ? (
        <div
          className={
            viewMode === 'grid'
              ? 'mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'
              : 'mt-8 flex flex-col gap-4'
          }
        >
          {pagination.items.map((article) => {
            const formattedDate = formatArticleDate(article.publishedAt)
            const hashtags = article.hashtags ?? []

            return (
              <article
                key={article.slug}
                className={`article-card group relative rounded-sm border border-[var(--line)] bg-[var(--surface)] p-6 transition hover:border-[var(--accent)] focus-within:border-[var(--accent)] ${
                  viewMode === 'list'
                    ? 'flex flex-col gap-5 sm:flex-row sm:items-start'
                    : 'flex flex-col'
                }`}
              >
                {article.cover && (
                  <div
                    className={`overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--background)] ${
                      viewMode === 'list'
                        ? 'sm:w-56 sm:shrink-0'
                        : 'mb-5'
                    }`}
                  >
                    <img
                      src={article.cover.url}
                      alt={article.cover.alt}
                      className="aspect-video w-full object-cover"
                    />
                  </div>
                )}

                <div className="flex flex-1 flex-col">
                  {formattedDate && (
                    <div className="text-xs text-[var(--muted)]">
                      <time dateTime={article.publishedAt}>{formattedDate}</time>
                    </div>
                  )}

                  <h2 className="mt-3 text-2xl tracking-tight">
                    <Link
                      href={`/artigos/${article.slug}/`}
                      className="after:absolute after:inset-0 after:content-[''] group-hover:underline focus:outline-none"
                    >
                      {article.title}
                    </Link>
                  </h2>

                  <p className="mt-3 leading-relaxed text-[var(--muted)]">
                    {article.summary}
                  </p>

                  {hashtags.length > 0 && (
                    <ul
                      aria-label="Hashtags"
                      className="mt-4 flex flex-wrap gap-1.5"
                    >
                      {hashtags.map((tag) => (
                        <li
                          key={tag}
                          className="rounded-sm border border-[var(--line)] bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--muted)]"
                        >
                          #{tag}
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="mt-auto pt-5 text-sm text-[var(--muted)]">
                    Por {article.author}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      ) : articles.length === 0 ? (
        <p className="mt-10 rounded-sm border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          {mode === 'demo'
            ? 'Nenhum artigo de demonstração disponível no momento.'
            : 'Os primeiros artigos estão em preparação e aparecerão aqui após publicação.'}
        </p>
      ) : (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-sm border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          <p>
            Nenhum artigo encontrado com os filtros selecionados.
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="cursor-pointer rounded-sm border border-[var(--line)] bg-[var(--surface-raised)] px-3.5 py-2 text-xs text-[var(--accent)] transition hover:border-[var(--accent)]"
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
                  className="rounded-sm border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  ← Anterior
                </Link>
              ) : (
                <span className="rounded-sm border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[var(--muted)] opacity-50">
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
                      className={`rounded-sm border px-3 py-1.5 tabular-nums transition ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent)] font-medium text-[var(--on-accent)]'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]'
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
                  className="rounded-sm border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  Próxima →
                </Link>
              ) : (
                <span className="rounded-sm border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[var(--muted)] opacity-50">
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
                className="cursor-pointer rounded-sm border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
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
                      className={`cursor-pointer rounded-sm border px-3 py-1.5 tabular-nums transition ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent)] font-medium text-[var(--on-accent)]'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]'
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
                className="cursor-pointer rounded-sm border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
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
