import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BlogExplorer } from '@/components/blog/blog-explorer'
import { EditorialHeader } from '@/components/blog/editorial-header'
import { BLOG_PAGE_SIZE } from '@/lib/article-meta'
import { getContent } from '@/lib/articles'

type Props = { params: Promise<{ page: string }> }

export async function generateStaticParams() {
  const { articles } = await getContent()
  const totalPages = Math.max(1, Math.ceil(articles.length / BLOG_PAGE_SIZE))
  return Array.from({ length: totalPages }, (_, index) => ({
    page: String(index + 1),
  }))
}

export async function generateMetadata({ params }: Props) {
  const { page } = await params
  return {
    title: `Blog — Página ${page} — GNUverse`,
  }
}

export default async function BlogPaginatedPage({ params }: Props) {
  const { page } = await params
  if (!/^\d+$/.test(page)) notFound()
  const pageNumber = Number.parseInt(page, 10)
  const { mode, articles } = await getContent()
  const totalPages = Math.max(1, Math.ceil(articles.length / BLOG_PAGE_SIZE))
  if (pageNumber < 1 || pageNumber > totalPages) notFound()

  return (
    <main className="mx-auto min-h-svh max-w-6xl px-6 py-10 sm:px-12">
      <EditorialHeader
        mode={mode}
        action={
          <Link
            href="/blog/escrever/"
            className="inline-flex items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--muted)] hover:bg-[var(--surface-raised)]"
          >
            Contribuir com um artigo
          </Link>
        }
      />
      <BlogExplorer
        articles={articles}
        mode={mode}
        currentPage={pageNumber}
        basePath="/blog"
      />
    </main>
  )
}
