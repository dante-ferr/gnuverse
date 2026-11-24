import Link from 'next/link'
import { SubmissionPanel } from '@/components/blog/submission-panel'
import { getContent } from '@/lib/articles'

export const metadata = {
  title: 'Escrever artigo — Blog — GNUverse',
}

export default async function WriteArticlePage() {
  const { mode } = await getContent()

  return (
    <main className="mx-auto min-h-svh max-w-4xl px-6 py-10 sm:px-12">
      <header>
        <Link
          href="/blog/"
          className="text-sm text-[var(--accent)] underline underline-offset-4"
        >
          ← Voltar ao blog
        </Link>
        <p className="mt-10 text-xs uppercase tracking-widest text-[var(--accent)]">
          Redação editorial
        </p>
        <h1 className="mt-3 text-4xl tracking-tight sm:text-5xl">
          Contribuir com um artigo
        </h1>
      </header>

      <SubmissionPanel mode={mode} standalone />
    </main>
  )
}
