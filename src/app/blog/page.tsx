import Link from 'next/link'
import { BlogExplorer } from '@/components/blog/blog-explorer'
import { EditorialHeader } from '@/components/blog/editorial-header'
import { getContent } from '@/lib/articles'

export const metadata = { title: 'Blog — GNUverse' }

export default async function BlogPage() {
  const { mode, articles } = await getContent()
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
        currentPage={1}
        basePath="/blog"
      />
    </main>
  )
}
