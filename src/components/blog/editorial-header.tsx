import Link from 'next/link'
import type { ReactNode } from 'react'

export function EditorialHeader({
  mode,
  action,
}: {
  mode: 'demo' | 'live'
  action?: ReactNode
}) {
  return (
    <header>
      <Link
        href="/"
        className="text-sm text-[var(--accent)] underline underline-offset-4"
      >
        ← GNUverse
      </Link>
      <p className="mt-16 text-xs uppercase tracking-widest text-[var(--accent)]">
        Pesquisa e perspectivas
      </p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-5xl tracking-tight">
          Nosso universo de ideias.
        </h1>
        {action}
      </div>
      {mode === 'demo' && (
        <p className="mt-6 rounded-sm border border-[var(--line)] bg-[var(--accent-soft)] p-4 text-sm text-[var(--ink)]">
          Modo demonstração: este exemplo ainda não veio do CMS. Configure o
          modo live para ver as publicações do grupo.
        </p>
      )}
    </header>
  )
}
