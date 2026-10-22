'use client'

import type { FormEvent } from 'react'
import { WindFrequencyFields } from './wind-frequency-fields'
import { BuildFrequencyFields } from './build-frequency-fields'
import styles from '../tower-game.module.css'

export type CreateTowerPanelProps = {
  busy: boolean
  maxCost: number
  defaultCost: number
  minContributions: number
  blockIntervalMs: number
  windMinBlocks: number
  windEveryBlocks: number
  onClose: () => void
  onCreateTower: (form: HTMLFormElement) => void
}

export function CreateTowerPanel({
  busy,
  maxCost,
  defaultCost,
  minContributions,
  blockIntervalMs,
  windMinBlocks,
  windEveryBlocks,
  onClose,
  onCreateTower,
}: CreateTowerPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onCreateTower(event.currentTarget)
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelTitle}>
        <h2>Criar torre</h2>
        <button className={styles.quiet} onClick={onClose}>
          Fechar
        </button>
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          Nome da torre
          <input name="name" required minLength={3} maxLength={60} />
        </label>
        <label>
          Custo por bloco
          <input
            name="cost"
            type="number"
            min="0"
            max={maxCost}
            defaultValue={defaultCost}
            required
          />
        </label>
        <label>
          Banimentos
          <select name="banMode">
            <option value="vote">Votação</option>
            <option value="bdfl">BDFL decide</option>
          </select>
        </label>
        <label>
          Restaurações
          <select name="restoreMode">
            <option value="vote">Votação</option>
            <option value="bdfl">BDFL decide</option>
          </select>
        </label>
        <label>
          Habilitação para votar
          <select name="eligibilityMode">
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
            defaultValue={minContributions}
            required
          />
        </label>
        <BuildFrequencyFields
          intervalMs={blockIntervalMs}
          checkpointEvery={5}
        />
        <WindFrequencyFields
          initial={windMinBlocks}
          interval={windEveryBlocks}
        />
        <details className={styles.eventLog}>
          <summary>Suspensão do criador</summary>
          <label className={styles.checkOption}>
            <input name="allowCreatorBan" type="checkbox" />
            <span>Permitir suspensão por votação</span>
          </label>
          <small>
            Escolha definitiva. Suspenso, o criador perde a administração desta
            torre até o fim da suspensão.
          </small>
        </details>
        <button className={styles.primary} disabled={busy}>
          Abrir torre ↗
        </button>
      </form>
    </section>
  )
}
