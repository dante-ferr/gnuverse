import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import { getContent } from '@/lib/articles'
import { formatArticleDate } from '@/lib/blog-explorer'
import { QuizCards } from '@/components/quiz/quiz-cards'

const articleConverters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  upload: ({ node }) => {
    const value = node.value as
      | { url?: string; alt?: string; credit?: string }
      | undefined
    if (!value || typeof value !== 'object' || !value.url) return null
    return (
      <figure>
        <img src={value.url} alt={value.alt || ''} />
        {value.credit && <figcaption>{value.credit}</figcaption>}
      </figure>
    )
  },
})

type Props = { params: Promise<{ slug: string }> }
export async function generateStaticParams() {
  const articles = (await getContent()).articles
  // Next.js exige ao menos um parâmetro na exportação. Esta rota reservada renderiza 404.
  return articles.length
    ? articles.map(({ slug }) => ({ slug }))
    : [{ slug: '__empty' }]
}
export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const article = (await getContent()).articles.find(
    (entry) => entry.slug === slug,
  )
  return {
    title: article ? `${article.title} — GNUverse` : 'Artigo — GNUverse',
    description: article?.summary,
  }
}
export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const { articles, mode, quizzes } = await getContent()
  const relatedQuizzes = quizzes.filter((quiz) => quiz.article?.slug === slug)
  const article = articles.find((entry) => entry.slug === slug)
  if (!article) notFound()
  const formattedDate = formatArticleDate(article.publishedAt)
  const hashtags = article.hashtags ?? []
  return (
    <main className="mx-auto min-h-svh max-w-3xl px-6 py-10 sm:px-12">
      <Link
        href="/blog/"
        className="text-sm text-[var(--accent)] underline underline-offset-4"
      >
        ← Voltar ao blog
      </Link>
      <article className="mt-16">
        <h1 className="text-4xl leading-tight tracking-tight sm:text-6xl">
          {article.title}
        </h1>
        <p className="mt-6 text-xl leading-relaxed text-[var(--muted)]">
          {article.summary}
        </p>
        <p className="mt-5 text-sm text-[var(--muted)]">
          Por {article.author}
          {formattedDate ? (
            <>
              {' · '}
              <time dateTime={article.publishedAt}>{formattedDate}</time>
            </>
          ) : null}
          {mode === 'demo' ? ' · Demonstração local' : ''}
        </p>
        {hashtags.length > 0 && (
          <ul
            aria-label="Hashtags do artigo"
            className="mt-4 flex flex-wrap gap-2"
          >
            {hashtags.map((tag) => (
              <li
                key={tag}
                className="rounded-sm border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--accent)]"
              >
                #{tag}
              </li>
            ))}
          </ul>
        )}
        {article.cover && (
          <figure className="mt-10">
            {/* A capa é copiada no build: nenhuma consulta ao CMS no navegador. */}
            <img
              src={article.cover.url}
              alt={article.cover.alt}
              className="w-full rounded-sm"
            />
            <figcaption className="mt-2 text-sm text-[var(--muted)]">
              {article.cover.credit}
            </figcaption>
          </figure>
        )}
        <RichText
          data={article.body}
          converters={articleConverters}
          className="article-body mt-12"
        />
        {article.references.length > 0 && (
          <aside
            className="mt-12 border-t border-[var(--line)] pt-6"
            aria-label="Referências"
          >
            <h2 className="text-xl font-semibold">Referências</h2>
            <ul className="mt-4 space-y-3">
              {article.references.map((reference) => (
                <li key={reference.url}>
                  <a
                    href={reference.url}
                    rel="noopener noreferrer"
                    target="_blank"
                    className="text-[var(--accent)] underline underline-offset-4"
                  >
                    {reference.label}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </article>
      {relatedQuizzes.length > 0 && <section className="mt-12 border-t border-[var(--line)] pt-8" aria-label="Quizzes relacionados">
        <h2 className="text-2xl">Continue explorando</h2>
        <p className="mt-3 text-sm text-[var(--muted)]">O que esta leitura despertou? Experimente os quizzes relacionados.</p>
        <QuizCards quizzes={relatedQuizzes} />
      </section>}
    </main>
  )
}
