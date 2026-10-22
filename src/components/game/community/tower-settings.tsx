'use client'

import type { Tower } from '../model/types'
import styles from '../tower-game.module.css'

type Props = {
  tower: Tower
  maxCost: number
  disabled: boolean
  onSave: (body: Record<string, string | number>) => Promise<void>
}

export function TowerSettings({ tower, maxCost, disabled, onSave }: Props) {
  return (
    <details className={styles.eventLog}>
      <summary>Administrar regras desta torre</summary>
      <p>
        Alterações ficam no registro público e só podem acontecer sem propostas
        pendentes. Os eleitores de cada proposta permanecem os definidos na
        abertura.
      </p>
      <form
        key={JSON.stringify(tower)}
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          const values = new FormData(event.currentTarget)
          void onSave({
            cost: Number(values.get('cost')),
            banMode: String(values.get('banMode')),
            restoreMode: String(values.get('restoreMode')),
            eligibilityMode: String(values.get('eligibilityMode')),
            minContributions: Number(values.get('minContributions')),
            reason: String(values.get('reason')),
          })
        }}
      >
        <label>
          Custo por bloco
          <input
            name="cost"
            type="number"
            min="0"
            max={maxCost}
            defaultValue={tower.cost}
            required
          />
        </label>
        <label>
          Banimentos
          <select name="banMode" defaultValue={tower.banMode}>
            <option value="vote">Votação</option>
            <option value="bdfl">BDFL decide</option>
          </select>
        </label>
        <label>
          Restaurações
          <select name="restoreMode" defaultValue={tower.restoreMode}>
            <option value="vote">Votação</option>
            <option value="bdfl">BDFL decide</option>
          </select>
        </label>
        <label>
          Habilitação para votar
          <select name="eligibilityMode" defaultValue={tower.eligibilityMode}>
            <option value="automatic">Por contribuições</option>
            <option value="manual">Manual pelo BDFL</option>
          </select>
        </label>
        <label>
          Contribuições necessárias
          <input
            name="minContributions"
            type="number"
            min="1"
            max="1000"
            defaultValue={tower.minContributions}
            required
          />
        </label>
        <label>
          Motivo público
          <input name="reason" required minLength={3} maxLength={500} />
        </label>
        <button className={styles.primary} disabled={disabled}>
          Salvar regras
        </button>
      </form>
    </details>
  )
}
