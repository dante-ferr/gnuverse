'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
const pages = [
  { href: '/', label: 'Início' },
  { href: '/jogo/', label: 'Jogo' },
  { href: '/blog/', label: 'Blog' },
]

export function SiteHeader() {
  const pathname = usePathname()
  return (
    <header className="site-header">
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
    </header>
  )
}
