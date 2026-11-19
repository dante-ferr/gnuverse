'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { AccountBanner } from './account/account-banner'
import { type User, type Wallet } from './model/types'
import styles from './game-shell.module.css'

type Props = {
  user: User | null
  wallet: Wallet | null
  secondsToCoin: number
  busy: boolean
  onLogout: () => void
  onOpenAuth: () => void
  showAccount?: boolean
  /** Site pages: brand | centered nav | account. Game room keeps the flex toolbar layout. */
  centeredNav?: boolean
  children?: ReactNode
}

export function GameTopBar({
  user,
  wallet,
  secondsToCoin,
  busy,
  onLogout,
  onOpenAuth,
  showAccount = true,
  centeredNav = false,
  children,
}: Props) {
  return (
    <header
      className={`${styles.gameTopBar}${centeredNav ? ` ${styles.gameTopBarCentered}` : ''}`}
    >
      <Link href="/" aria-label="GNUverse — início" className={styles.gameBrand}>
        <span aria-hidden="true">⌘</span>gnuverse
      </Link>
      {children}
      {showAccount && (
        <AccountBanner
          user={user}
          wallet={wallet}
          secondsToCoin={secondsToCoin}
          busy={busy}
          onLogout={onLogout}
          onOpenAuth={onOpenAuth}
        />
      )}
    </header>
  )
}
