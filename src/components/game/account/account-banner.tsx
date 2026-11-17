'use client'
import { type User, type Wallet } from '../model/types'
import styles from '../game-shell.module.css'

type Props = {
  user: User | null
  wallet: Wallet | null
  secondsToCoin: number
  busy: boolean
  onLogout: () => void
  onOpenAuth: () => void
}
export function AccountBanner({
  user,
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
            <strong>{user.nickname}</strong>
            <span title={wallet ? `${wallet.balance} de ${wallet.cap} moedas` : undefined}>
              {wallet ? `${wallet.balance}/${wallet.cap}` : '…'}
            </span>
            {wallet && (
              <small title="Tempo até a próxima moeda">
                {wallet.balance >= wallet.cap ? 'cheia' : `${secondsToCoin}s`}
              </small>
            )}
          </p>
          <button className={styles.quiet} onClick={onLogout} disabled={busy}>
            Sair
          </button>
        </>
      ) : (
        <button className={styles.primary} onClick={onOpenAuth}>Entrar</button>
      )}
    </div>
  )
}
