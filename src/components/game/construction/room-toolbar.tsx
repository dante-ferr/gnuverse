'use client'
import { type Connection } from '../hooks/use-room-lobby'
import styles from '../game-shell.module.css'

type Props = {
  connection: Connection
  title: string
  product?: string
  showBack?: boolean
  onCreate: () => void
  canDelete: boolean
  onDelete: () => void
}

export function RoomToolbar({
  connection,
  title,
  product = 'Open Pipeline',
  showBack = true,
  onCreate,
  canDelete,
  onDelete,
}: Props) {
  return (
    <div className={styles.detailToolbar}>
      {showBack && (
        <a className={styles.backLink} href="/jogo/">
          ← Salas
        </a>
      )}
      <div className={styles.gameTitleBlock}>
        <p className={styles.gameProduct}>{product}</p>
        <h1 className={styles.gameTitle}>{title.trim() || 'Sala'}</h1>
      </div>
      <span className={`${styles.connection} ${connection === 'live' ? styles.live : ''}`}>
        <i />
        {connection === 'live' ? 'Ao vivo' : connection === 'connecting' ? 'Conectando' : 'Offline'}
      </span>
      <button className={styles.secondary} onClick={onCreate}>
        Nova sala
      </button>
      {canDelete && (
        <button
          className={styles.secondary}
          onClick={() => {
            if (window.confirm('Excluir esta sala e todo o histórico?')) onDelete()
          }}
        >
          Excluir
        </button>
      )}
    </div>
  )
}