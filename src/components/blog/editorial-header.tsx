import Link from 'next/link'

export function EditorialHeader({ mode }: { mode: 'demo' | 'live' }) {
  return (
    <>
      <Link
        href="/"
        className="text-sm text-[var(--accent)] underline underline-offset-4"
      >
        ← GNUverse
      </Link>
      <p className="mt-16 text-xs uppercase tracking-widest text-[var(--accent)]">
        Pesquisa e perspectivas
      </p>
      <h1 className="mt-4 text-5xl tracking-tight">
        Nosso universo de ideias.
      </h1>
      {mode === 'demo' && (
        <p className="mt-6 rounded-sm border border-[var(--line)] bg-[var(--accent-soft)] p-4 text-sm text-[var(--ink)]">
          Modo demonstração: este exemplo ainda não veio do CMS. Configure o
          modo live para ver as publicações do grupo.
        </p>
      )}
    </>
  )
}
