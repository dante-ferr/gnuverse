import type { ReactNode } from 'react'

export function EditorialHeader({
  mode,
  action,
}: {
  mode: 'demo' | 'live'
  action?: ReactNode
}) {
  return (
    <header className="pt-2">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-[60ch]">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--ink)] sm:text-5xl">
            Nosso universo de ideias.
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">
            Artigos, relatos e reflexões do coletivo sobre software livre,
            autonomia digital e democratização da tecnologia.
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {mode === 'demo' && (
        <p className="mt-6 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
          Modo demonstração: este exemplo ainda não veio do CMS. Configure o
          modo live para ver as publicações do grupo.
        </p>
      )}
    </header>
  )
}
