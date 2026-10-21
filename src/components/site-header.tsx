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
    <header className="relative z-10 mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-6 pt-8 sm:px-12 lg:px-20">
      <Link href="/" aria-label="GNUverse — início" className="text-xl font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-700">
        gnuverse<span aria-hidden="true" className="text-violet-700">↗</span>
      </Link>
      <nav aria-label="Navegação principal" className="flex items-center gap-1 text-sm sm:gap-3">
        {pages.map((page) => {
          const active = page.href === '/'
            ? pathname === '/'
            : page.href === '/blog/'
              ? pathname?.startsWith('/blog') || pathname?.startsWith('/artigos')
              : pathname?.startsWith('/jogo')

          return (
            <Link key={page.href} href={page.href} aria-current={active ? 'page' : undefined}
              className={`rounded-full px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-700 ${active ? 'bg-violet-100 text-violet-900' : 'text-stone-600 hover:bg-white/80 hover:text-violet-800'}`}>
              {page.label}
            </Link>
          )
        })}
      </nav>
      <div aria-hidden="true" className="w-full border-b border-stone-300" />
    </header>
  )
}
