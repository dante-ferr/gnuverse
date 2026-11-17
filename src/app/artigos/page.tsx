import { BlogExplorer } from '@/components/blog/blog-explorer'
import { EditorialHeader } from '@/components/blog/editorial-header'
import { getContent } from '@/lib/articles'

export const metadata = { title: 'Artigos — GNUverse' }

export default async function ArticlesPage() {
  const { mode, articles } = await getContent()
  return (
    <main className="mx-auto min-h-svh max-w-6xl px-6 py-10 sm:px-12">
      <EditorialHeader mode={mode} />
      <BlogExplorer articles={articles} mode={mode} />
    </main>
  )
}
