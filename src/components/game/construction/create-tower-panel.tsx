'use client'

import type { FormEvent } from 'react'
import styles from '../tower-game.module.css'

export type CreateTowerPanelProps = {
  busy: boolean
  maxCost: number
  defaultCost: number
  minContributions: number
  onClose: () => void
  onCreateTower: (form: HTMLFormElement) => void
}

export function CreateTowerPanel({
  busy,
  maxCost,
  defaultCost,
  minContributions,
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
        <h2>Um novo começo.</h2>
        <button className={styles.quiet} onClick={onClose}>
          Fechar
        </button>
      </div>
      <p>
        Como criador, você será o BDFL desta torre. Escolha como a comunidade
        toma decisões.
      </p>
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
        <label className={styles.checkOption}>
          <input name="allowCreatorBan" type="checkbox" />
          <span>
            Permitir que o criador/BDFL seja suspenso por votação.
            <small>
              Esta escolha é definitiva. Durante a suspensão, o criador também
              perde temporariamente as ações de administração nesta torre.
            </small>
          </span>
        </label>
        <button className={styles.primary} disabled={busy}>
          Abrir torre ↗
        </button>
      </form>
    </section>
  )
}
