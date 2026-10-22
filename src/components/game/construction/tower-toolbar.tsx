'use client'
import { type Tower } from '../model/types'
import { type Connection } from '../hooks/use-tower-lobby'
import styles from '../tower-game.module.css'

type Props = {
  towers: Tower[]
  towerId: string
  connection: Connection
  onSelect: (id: string) => void
  onCreate: () => void
}
export function TowerToolbar({
  towers,
  towerId,
  connection,
  onSelect,
  onCreate,
}: Props) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.towerPicker}>
        <label htmlFor="tower">Torre</label>
        <select
          id="tower"
          value={towerId}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="" disabled>
            {towers.length ? 'Escolher' : 'Sem torres'}
          </option>
          {towers.map((tower) => (
            <option key={tower.id} value={tower.id}>
              {tower.name}
            </option>
          ))}
        </select>
      </div>
      <span
        className={`${styles.connection} ${connection === 'live' ? styles.live : ''}`}
      >
        <i />
        {connection === 'live'
          ? 'Ao vivo'
          : connection === 'connecting'
            ? 'Conectando'
            : 'Offline'}
      </span>
      <button className={styles.secondary} onClick={onCreate}>
        Criar torre
      </button>
    </div>
  )
}
