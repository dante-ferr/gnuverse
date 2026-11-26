'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { GameTopBar } from './game/game-top-bar'
import { useGameSession } from './game/hooks/use-game-session'
import styles from './game/game-shell.module.css'

const pages = [
  { href: '/', label: 'Início' },
  { href: '/jogo/', label: 'Jogo' },
  { href: '/blog/', label: 'Blog' },
  { href: '/quizzes/', label: 'Quizzes' },
  { href: '/sobre/', label: 'Sobre' },
]

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const session = useGameSession()
  const [busy, setBusy] = useState(false)

  // In-room chrome owns the top bar; lobby/dashboard uses this site bar.
  if (pathname?.startsWith('/jogo/sala')) {
    return null
  }

  return (
    <GameTopBar
      user={session.user}
      avatarUrl={session.avatarUrl}
      wallet={session.wallet}
      secondsToCoin={session.secondsToCoin}
      busy={busy}
      showAccount
      centeredNav
      onLogout={() => {
        setBusy(true)
        void session.logout().finally(() => setBusy(false))
      }}
      onOpenAuth={() => router.push('/login/')}
    >
      <nav aria-label="Navegação principal" className={styles.topBarNav}>
        {pages.map((page) => {
          const active =
            page.href === '/'
              ? pathname === '/'
              : page.href === '/blog/'
                ? pathname?.startsWith('/blog') || pathname?.startsWith('/artigos')
                : pathname?.startsWith(page.href)
          return (
            <Link
              key={page.href}
              href={page.href}
              aria-current={active ? 'page' : undefined}
              className={styles.topBarLink}
            >
              {page.label}
            </Link>
          )
        })}
      </nav>
    </GameTopBar>
  )
}
