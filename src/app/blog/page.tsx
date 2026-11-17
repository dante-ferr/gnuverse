import { BlogExplorer } from '@/components/blog/blog-explorer'
import { SubmissionPanel } from '@/components/blog/submission-panel'
import { getContent } from '@/lib/articles'

export const metadata = { title: 'Blog — GNUverse' }

export default async function BlogPage() {
  const { mode, articles } = await getContent()
  return (
    <main className="mx-auto min-h-svh max-w-6xl px-6 py-10 sm:px-12">
      <SubmissionPanel mode={mode} />
      <BlogExplorer
        articles={articles}
        mode={mode}
        currentPage={1}
        basePath="/blog"
      />
    </main>
  )
}
