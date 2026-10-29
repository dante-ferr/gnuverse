'use client'

import { useEffect, useId, useRef, type FormEvent } from 'react'
import { WindFrequencyFields } from './wind-frequency-fields'
import { BuildFrequencyFields } from './build-frequency-fields'
import styles from '../tower-game.module.css'

export type CreateTowerPanelProps = {
  busy: boolean
  error: string
  loading?: boolean
  loginHref?: string
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
  error,
  loading = false,
  loginHref,
  maxCost,
  defaultCost,
  minContributions,
  blockIntervalMs,
  windMinBlocks,
  windEveryBlocks,
  onClose,
  onCreateTower,
}: CreateTowerPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading || loginHref) return
    onCreateTower(event.currentTarget)
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.createTowerOverlay}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom
        ) onClose()
      }}
    >
      <div className={styles.panelTitle}>
        <h2 id={titleId}>Criar torre</h2>
        <button type="button" className={styles.quiet} onClick={onClose}>
          Fechar
        </button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {loginHref && (
        <p className={styles.message}>
          <a href={loginHref}>Entre na sua conta</a> para criar uma torre.
        </p>
      )}
      {loading ? <p role="status">Carregando as regras da torre…</p> : (
      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          Nome da torre
          <input name="name" required minLength={3} maxLength={60} autoFocus />
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
        <button className={styles.primary} disabled={busy || Boolean(loginHref)}>
          Abrir torre ↗
        </button>
      </form>
      )}
    </dialog>
  )
}
