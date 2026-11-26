import { getTeamContent } from '@/lib/team'

export const metadata = {
  title: 'Sobre — GNUverse',
  description:
    'Conheça o grupo de participantes que pesquisa e constrói o GNUverse.',
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'GN'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export default async function AboutPage() {
  const { mode, members } = await getTeamContent()

  return (
    <main className="[overflow-wrap:anywhere] mx-auto min-h-svh max-w-6xl px-6 py-10 sm:px-12">
      <header className="border-b border-[var(--line)] pt-2 pb-8">
        <div className="max-w-[64ch]">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--ink)] sm:text-5xl">
            Sobre o GNUverse
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            O GNUverse é um projeto coletivo desenvolvido por estudantes da
            disciplina MATA68: Computador, Ética e Sociedade (2026.2) para investigar como o software livre
            amplia o acesso à tecnologia — combinando jogo cooperativo, blog
            autoral e quizzes abertos.
          </p>
        </div>
        {mode === 'demo' && (
          <p className="mt-6 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
            Modo demonstração: os perfis abaixo são exemplos locais e ainda não
            vieram do CMS.
          </p>
        )}
      </header>

      <section aria-labelledby="team-heading" className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="team-heading"
            className="text-2xl font-semibold tracking-tight text-[var(--ink)]"
          >
            Participantes
          </h2>
          {members.length > 0 && (
            <p className="font-mono text-xs tabular-nums text-[var(--muted)]">
              {members.length}{' '}
              {members.length === 1 ? 'integrante' : 'integrantes'}
            </p>
          )}
        </div>

        {members.length > 0 ? (
          <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => {
              const bio = member.bio?.trim()
              return (
                <li
                  key={member.id}
                  className="flex flex-col rounded-md border border-[var(--line)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--muted)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="aspect-square h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface-raised)]">
                      {member.photo ? (
                        <img
                          src={member.photo.url}
                          alt={member.photo.alt}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden="true"
                          className="flex h-full w-full items-center justify-center font-mono text-sm font-medium text-[var(--accent)]"
                        >
                          {getInitials(member.name)}
                        </div>
                      )}
                    </div>
                    <h3 className="min-w-0 text-lg font-semibold leading-snug tracking-tight text-[var(--ink)]">
                      {member.name}
                    </h3>
                  </div>

                  {bio ? (
                    <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
                      {bio}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-6 rounded-md border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-10 text-center text-sm text-[var(--muted)]">
            Os perfis dos participantes aparecerão aqui assim que forem
            ativados no painel editorial.
          </p>
        )}
      </section>
    </main>
  )
}
