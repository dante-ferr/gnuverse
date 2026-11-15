'use client'
import { type Connection } from '../hooks/use-tower-lobby'
import styles from '../tower-game.module.css'

type Props = {
  connection: Connection
  onCreate: () => void
  canDelete: boolean
  onDelete: () => void
}

export function TowerToolbar({ connection, onCreate, canDelete, onDelete }: Props) {
  return (
    <div className={styles.detailToolbar}>
      <a className={styles.backLink} href="/jogo/">← Todas as cavernas</a>
      <span className={`${styles.connection} ${connection === 'live' ? styles.live : ''}`}>
        <i />
        {connection === 'live' ? 'Ao vivo' : connection === 'connecting' ? 'Conectando' : 'Offline'}
      </span>
      <button className={styles.secondary} onClick={onCreate}>Nova caverna</button>
      {canDelete && (
        <button className={styles.secondary} onClick={() => {
          if (window.confirm('Excluir esta sala e todo o histórico?')) onDelete()
        }}>Excluir sala</button>
      )}
    </div>
  )
}
