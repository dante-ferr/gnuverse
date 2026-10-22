import Link from 'next/link'
import { categoryNames, getContent } from '@/lib/articles'

export const metadata = { title: 'Artigos — GNUverse' }

export default async function ArticlesPage() {
  const { mode, articles } = await getContent()
  return (
    <main className="mx-auto min-h-svh max-w-5xl px-6 py-10 sm:px-12">
      <Link
        href="/"
        className="text-sm text-[var(--accent)] underline underline-offset-4"
      >
        ← GNUverse
      </Link>
      <p className="mt-16 text-xs uppercase tracking-widest text-[var(--accent)]">
        Pesquisa e perspectivas
      </p>
      <h1 className="mt-4 text-5xl tracking-tight">
        Nosso universo de ideias.
      </h1>
      {mode === 'demo' && (
        <p className="mt-6 rounded-sm border border-[var(--line)] bg-[var(--accent-soft)] p-4 text-sm text-[var(--ink)]">
          Modo demonstração: este exemplo ainda não veio do CMS. Configure o
          modo live para ver as publicações do grupo.
        </p>
      )}
      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {articles.map((article) => (
          <article
            key={article.slug}
            className="article-card rounded-sm border border-[var(--line)] bg-[var(--surface)] p-6 transition hover:border-[var(--accent)]"
          >
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
            <p className="mt-6 text-sm text-[var(--muted)]">
              Por {article.author}
            </p>
          </article>
        ))}
      </div>
      {articles.length === 0 && (
        <p className="mt-10 text-[var(--muted)]">
          Os primeiros artigos estão em preparação.
        </p>
      )}
    </main>
  )
}
