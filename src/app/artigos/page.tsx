import Link from 'next/link'
import { categoryNames, getContent } from '@/lib/articles'

export const metadata = { title: 'Artigos — GNUverse' }

export default async function ArticlesPage() {
  const { mode, articles } = await getContent()
  return (
    <main className="mx-auto min-h-svh max-w-5xl px-6 py-10 sm:px-12">
      <Link href="/" className="text-sm text-violet-800 underline underline-offset-4">← GNUverse</Link>
      <p className="mt-16 text-xs uppercase tracking-widest text-violet-800">Pesquisa e perspectivas</p>
      <h1 className="mt-4 text-5xl tracking-tight">Nosso universo de ideias.</h1>
      {mode === 'demo' && <p className="mt-6 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">Modo demonstração: este exemplo ainda não veio do CMS. Configure o modo live para ver as publicações do grupo.</p>}
      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {articles.map((article) => (
          <article key={article.slug} className="rounded-2xl border border-stone-300 bg-white/60 p-6 transition hover:border-violet-400">
            <p className="text-xs uppercase tracking-widest text-violet-800">{categoryNames[article.category] ?? article.category}</p>
            <h2 className="mt-4 text-2xl tracking-tight"><Link href={`/artigos/${article.slug}/`} className="hover:underline">{article.title}</Link></h2>
            <p className="mt-4 leading-relaxed text-stone-600">{article.summary}</p>
            <p className="mt-6 text-sm text-stone-500">Por {article.author}</p>
          </article>
        ))}
      </div>
      {articles.length === 0 && <p className="mt-10 text-stone-600">Os primeiros artigos estão em preparação.</p>}
    </main>
  )
}
