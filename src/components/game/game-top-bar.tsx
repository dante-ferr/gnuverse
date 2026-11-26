'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { AccountBanner } from './account/account-banner'
import { type User, type Wallet } from './model/types'
import styles from './game-shell.module.css'

type Props = {
  user: User | null
  avatarUrl?: string | null
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
  avatarUrl,
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
        <img
          src="/gnuverse-logo.svg"
          alt=""
          width={22}
          height={22}
          className={styles.gameBrandMark}
          decoding="async"
        />
        gnuverse
      </Link>
      {children}
      {showAccount && (
        <AccountBanner
          user={user}
          avatarUrl={avatarUrl}
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
