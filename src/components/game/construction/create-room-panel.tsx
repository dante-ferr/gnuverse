'use client'

import { useEffect, useId, useRef, type FormEvent } from 'react'
import styles from '../game-shell.module.css'

export type CreateRoomPanelProps = {
  busy: boolean
  error: string
  loading?: boolean
  loginHref?: string
  minContributions: number
  onClose: () => void
  onCreateRoom: (form: HTMLFormElement) => void
}

export function CreateRoomPanel({
  busy,
  error,
  loading = false,
  loginHref,
  minContributions,
  onClose,
  onCreateRoom,
}: CreateRoomPanelProps) {
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
    onCreateRoom(event.currentTarget)
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.createRoomOverlay}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        onClose()
      }}
    >
      <div className={styles.panelTitle}>
        <h2 id={titleId}>Nova sala</h2>
        <button type="button" className={styles.quiet} onClick={onClose}>
          Fechar
        </button>
      </div>
      {loginHref ? (
        <p>
          <a href={loginHref}>Entre na conta</a> para criar uma sala.
        </p>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            Nome
            <input name="name" required minLength={3} maxLength={60} />
          </label>
          <label>
            Contribuições mínimas para propor
            <input
              name="minContributions"
              type="number"
              defaultValue={minContributions}
              min={1}
            />
          </label>
          <p>Suspensões de participantes são sempre decididas pelo BDFL.</p>
          {error && <p role="alert">{error}</p>}
          <button className={styles.primary} disabled={busy || loading}>
            Criar sala
          </button>
        </form>
      )}
    </dialog>
  )
}
