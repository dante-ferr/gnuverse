'use client'
import { type User, type Wallet } from '../model/types'
import styles from '../tower-game.module.css'

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
    <div className={styles.heading}>
      <div>
        <h1>Torres colaborativas</h1>
      </div>
      <div className={styles.account}>
        {user ? (
          <>
            <div>
              <strong>{user.nickname}</strong>
              <span>
                {wallet
                  ? `${wallet.balance} / ${wallet.cap} moedas`
                  : 'Carregando carteira…'}
              </span>
              <small>
                {wallet &&
                  (wallet.balance >= wallet.cap
                    ? 'Carteira cheia'
                    : `Próxima moeda em ${secondsToCoin}s`)}
              </small>
            </div>
            <button className={styles.quiet} onClick={onLogout} disabled={busy}>
              Sair
            </button>
          </>
        ) : (
          <button className={styles.primary} onClick={onOpenAuth}>Entrar</button>
        )}
      </div>
    </div>
  )
}
