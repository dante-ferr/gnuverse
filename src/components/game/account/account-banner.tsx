'use client'
import Link from 'next/link'
import { CoinIcon } from '../coin-icon'
import { type User, type Wallet } from '../model/types'
import styles from '../game-shell.module.css'

type Props = {
  user: User | null
  avatarUrl?: string | null
  wallet: Wallet | null
  secondsToCoin: number
  busy: boolean
  onLogout: () => void
  onOpenAuth: () => void
}

function getInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'GN'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function AccountBanner({
  user,
  avatarUrl,
  wallet,
  secondsToCoin,
  busy,
  onLogout,
  onOpenAuth,
}: Props) {
  return (
    <div className={styles.account}>
      {user ? (
        <>
          <p className={styles.accountLine}>
            <Link
              href="/perfil/"
              title="Gerenciar foto de perfil"
              className={styles.accountProfileLink}
            >
              <span className={styles.accountAvatar} aria-hidden="true">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className={styles.accountAvatarImg} />
                ) : (
                  getInitials(user.nickname)
                )}
              </span>
              <strong>{user.nickname}</strong>
            </Link>
            <span
              title={
                wallet
                  ? wallet.balance > wallet.cap
                    ? `${wallet.balance} moedas. O rendimento por tempo para em ${wallet.cap}.`
                    : `${wallet.balance} de ${wallet.cap} moedas`
                  : undefined
              }
            >
              {wallet ? (
                <>
                  {wallet.balance}/{wallet.cap}
                  <CoinIcon />
                </>
              ) : (
                '…'
              )}
            </span>
            {wallet && Boolean(wallet.rewardBalance) && (
              <span title="Moedas de recompensa por leituras e quizzes. Sem limite, gastas depois das moedas de rendimento.">
                +{wallet.rewardBalance}
                <CoinIcon />
              </span>
            )}
            {wallet && (
              <small title="Tempo até a próxima moeda">
                {wallet.balance > wallet.cap
                  ? 'renda pausada'
                  : wallet.balance === wallet.cap
                    ? 'cheia'
                    : `${secondsToCoin}s`}
              </small>
            )}
          </p>
          <button className={styles.quiet} onClick={onLogout} disabled={busy}>
            Sair
          </button>
        </>
      ) : (
        <button className={styles.primary} onClick={onOpenAuth}>
          Entrar
        </button>
      )}
    </div>
  )
}
