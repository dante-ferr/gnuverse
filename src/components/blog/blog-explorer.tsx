'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { categoryNames, type Article } from '@/lib/article-meta'

export type BlogExplorerProps = {
  articles: Article[]
  mode: 'demo' | 'live'
}

export function BlogExplorer({ articles, mode }: BlogExplorerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const key of Object.keys(categoryNames)) {
      map[key] = 0
    }
    for (const article of articles) {
      map[article.category] = (map[article.category] ?? 0) + 1
    }
    return map
  }, [articles])

  const filteredArticles = useMemo(() => {
    if (selectedCategory === 'all') return articles
    return articles.filter((article) => article.category === selectedCategory)
  }, [articles, selectedCategory])

  const filterButtons = [
    { key: 'all', label: 'Todas', count: articles.length },
    ...Object.entries(categoryNames).map(([key, label]) => ({
      key,
      label,
      count: counts[key] ?? 0,
    })),
  ]

  return (
    <section aria-label="Explorar artigos">
      <div
        role="group"
        aria-label="Filtrar artigos por categoria"
        className="mt-10 flex flex-wrap gap-2.5"
      >
        {filterButtons.map((filter) => {
          const active = selectedCategory === filter.key
          return (
            <button
              key={filter.key}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedCategory(filter.key)}
              className={`cursor-pointer rounded-sm border px-3.5 py-2 text-sm transition ${
                active
                  ? 'border-[var(--accent)] bg-[var(--accent)] font-medium text-[var(--on-accent)]'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]'
              }`}
            >
              <span>{filter.label}</span>
              <span
                className={`ml-2 text-xs tabular-nums ${
                  active ? 'opacity-80' : 'text-[var(--muted)]'
                }`}
              >
                {filter.count}
              </span>
            </button>
          )
        })}
      </div>

      {filteredArticles.length > 0 ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {filteredArticles.map((article) => (
            <article
              key={article.slug}
              className="article-card flex flex-col rounded-sm border border-[var(--line)] bg-[var(--surface)] p-6 transition hover:border-[var(--accent)]"
            >
              {article.cover && (
                <div className="mb-5 overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--background)]">
                  <img
                    src={article.cover.url}
                    alt={article.cover.alt}
                    className="aspect-video w-full object-cover"
                  />
                </div>
              )}
              <p className="text-xs uppercase tracking-widest text-[var(--accent)]">
                {categoryNames[article.category] ?? article.category}
              </p>
              <h2 className="mt-4 text-2xl tracking-tight">
                <Link
                  href={`/artigos/${article.slug}/`}
                  className="hover:underline"
                >
                  {article.title}
                </Link>
              </h2>
              <p className="mt-4 leading-relaxed text-[var(--muted)]">
                {article.summary}
              </p>
              <p className="mt-auto pt-6 text-sm text-[var(--muted)]">
                Por {article.author}
              </p>
            </article>
          ))}
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
            Ainda não há artigos publicados na categoria{' '}
            <strong className="text-[var(--ink)]">
              {categoryNames[selectedCategory] ?? selectedCategory}
            </strong>
            .
          </p>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className="cursor-pointer rounded-sm border border-[var(--line)] bg-[var(--surface-raised)] px-3.5 py-2 text-xs text-[var(--accent)] transition hover:border-[var(--accent)]"
          >
            Ver todas as categorias
          </button>
        </div>
      )}
    </section>
  )
}
