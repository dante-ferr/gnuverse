import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { categoryNames, getContent } from '@/lib/articles'

type Props = { params: Promise<{ slug: string }> }
export async function generateStaticParams() {
  const articles = (await getContent()).articles
  // Next.js exige ao menos um parâmetro na exportação. Esta rota reservada renderiza 404.
  return articles.length ? articles.map(({ slug }) => ({ slug })) : [{ slug: '__empty' }]
}
export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const article = (await getContent()).articles.find((entry) => entry.slug === slug)
  return { title: article ? `${article.title} — GNUverse` : 'Artigo — GNUverse', description: article?.summary }
}
export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const { articles, mode } = await getContent()
  const article = articles.find((entry) => entry.slug === slug)
  if (!article) notFound()
  return (
    <main className="mx-auto min-h-svh max-w-3xl px-6 py-10 sm:px-12">
      <Link href="/artigos/" className="text-sm text-violet-800 underline underline-offset-4">← Todos os artigos</Link>
      <article className="mt-16">
        <p className="text-xs uppercase tracking-widest text-violet-800">{categoryNames[article.category] ?? article.category}</p>
        <h1 className="mt-4 text-4xl leading-tight tracking-tight sm:text-6xl">{article.title}</h1>
        <p className="mt-6 text-xl leading-relaxed text-stone-600">{article.summary}</p>
        <p className="mt-5 text-sm text-stone-500">Por {article.author}{mode === 'demo' ? ' · Demonstração local' : ''}</p>
        {article.cover && <figure className="mt-10">
          {/* A capa é copiada no build: nenhuma consulta ao CMS no navegador. */}
          <img src={article.cover.url} alt={article.cover.alt} className="w-full rounded-2xl" />
          <figcaption className="mt-2 text-sm text-stone-500">{article.cover.credit}</figcaption>
        </figure>}
        <RichText data={article.body} className="article-body mt-12" />
        {article.references.length > 0 && <aside className="mt-12 border-t border-stone-300 pt-6" aria-label="Referências">
          <h2 className="text-xl font-semibold">Referências</h2>
          <ul className="mt-4 space-y-3">{article.references.map((reference) => <li key={reference.url}><a href={reference.url} rel="noopener noreferrer" target="_blank" className="text-violet-800 underline underline-offset-4">{reference.label}</a></li>)}</ul>
        </aside>}
      </article>
    </main>
  )
}
