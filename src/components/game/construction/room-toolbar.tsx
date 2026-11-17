'use client'
import { type Connection } from '../hooks/use-room-lobby'
import styles from '../game-shell.module.css'

type Props = {
  connection: Connection
  roomName?: string
  onCreate: () => void
  canDelete: boolean
  onDelete: () => void
  canAdvance?: boolean
  onAdvance?: () => void
  busy?: boolean
}

export function RoomToolbar({
  connection,
  roomName,
  onCreate,
  canDelete,
  onDelete,
  canAdvance,
  onAdvance,
  busy,
}: Props) {
  return (
    <div className={styles.detailToolbar}>
      <a className={styles.backLink} href="/jogo/">
        ← Salas
      </a>
      <div className={styles.gameTitleBlock}>
        <p className={styles.gameProduct}>Open Pipeline</p>
        <h1 className={styles.gameTitle}>{roomName?.trim() || 'Sala'}</h1>
      </div>
      <span className={`${styles.connection} ${connection === 'live' ? styles.live : ''}`}>
        <i />
        {connection === 'live' ? 'Ao vivo' : connection === 'connecting' ? 'Conectando' : 'Offline'}
      </span>
      {canAdvance && onAdvance ? (
        <button type="button" className={styles.quiet} disabled={busy} onClick={onAdvance}>
          Avançar versão
        </button>
      ) : null}
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
