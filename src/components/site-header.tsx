'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useGameSession } from './game/hooks/use-game-session'
const pages = [
  { href: '/', label: 'Início' },
  { href: '/jogo/', label: 'Jogo' },
  { href: '/blog/', label: 'Blog' },
]

export function SiteHeader() {
  const pathname = usePathname()
  const session = useGameSession()
  return (
    <header className={`site-header${pathname !== '/' ? ' site-header-centered' : ''}`}>
      <Link href="/" aria-label="GNUverse — início" className="site-brand">
        <span aria-hidden="true">⌘</span>gnuverse
      </Link>
      <nav aria-label="Navegação principal" className="site-nav">
        {pages.map((page) => {
          const active =
            page.href === '/'
              ? pathname === '/'
              : page.href === '/blog/'
                ? pathname?.startsWith('/blog') ||
                  pathname?.startsWith('/artigos')
                : pathname?.startsWith('/jogo')
          return (
            <Link
              key={page.href}
              href={page.href}
              aria-current={active ? 'page' : undefined}
              className="site-link"
            >
              {page.label}
            </Link>
          )
        })}
      </nav>
      {pathname !== '/' && (
        <div className="site-account">
          {session.user ? (
            <Link className="site-avatar" href="/jogo/" aria-label={`Perfil de ${session.user.nickname}`} title={session.user.nickname}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c.6-4 3-6 7-6s6.4 2 7 6" />
              </svg>
            </Link>
          ) : (
            <div className="site-auth-links">
              <Link href="/login/">Entrar</Link>
              <Link href="/cadastro/">Registrar</Link>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
