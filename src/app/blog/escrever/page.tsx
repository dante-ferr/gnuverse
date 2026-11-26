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
        <h1 className="mt-8 text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--ink)] sm:text-5xl">
          Contribuir com um artigo
        </h1>
        <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-[var(--muted)]">
          Escreva seu texto, anexe imagens e envie para a revisão editorial do coletivo.
        </p>
      </header>

      <SubmissionPanel mode={mode} standalone />
    </main>
  )
}
