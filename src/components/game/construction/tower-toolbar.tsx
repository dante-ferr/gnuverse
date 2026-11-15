'use client'
import { type Connection } from '../hooks/use-tower-lobby'
import styles from '../tower-game.module.css'

type Props = {
  connection: Connection
  towerName?: string
  onCreate: () => void
  canDelete: boolean
  onDelete: () => void
}

export function TowerToolbar({ connection, towerName, onCreate, canDelete, onDelete }: Props) {
  return (
    <div className={styles.detailToolbar}>
      <a className={styles.backLink} href="/jogo/">← Cavernas</a>
      <h1 className={styles.gameTitle}>{towerName || 'Árvore na caverna'}</h1>
      <span className={`${styles.connection} ${connection === 'live' ? styles.live : ''}`}>
        <i />
        {connection === 'live' ? 'Ao vivo' : connection === 'connecting' ? 'Conectando' : 'Offline'}
      </span>
      <button className={styles.secondary} onClick={onCreate}>Nova caverna</button>
      {canDelete && (
        <button className={styles.secondary} onClick={() => {
          if (window.confirm('Excluir esta sala e todo o histórico?')) onDelete()
        }}>Excluir</button>
      )}
    </div>
  )
}
