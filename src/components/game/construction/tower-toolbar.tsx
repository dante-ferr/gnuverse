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
        <label htmlFor="tower">Construção atual</label>
        <select
          id="tower"
          value={towerId}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="" disabled>
            {towers.length ? 'Escolha uma torre' : 'Nenhuma torre ainda'}
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
          ? 'Ao vivo · servidor conectado'
          : connection === 'connecting'
            ? 'Conectando…'
            : 'Servidor desconectado'}
      </span>
      <button className={styles.secondary} onClick={onCreate}>
        + Criar torre
      </button>
    </div>
  )
}
