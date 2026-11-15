'use client'

import { useEffect, useRef, useState } from 'react'
import { type ProposalTarget } from '../hooks/use-game-controller'
import styles from '../tower-game.module.css'

type Props = {
  target: ProposalTarget
  busy: boolean
  onCancel: () => void
  onSubmit: (reason: string) => void
}
export function ProposalForm({ target, busy, onCancel, onSubmit }: Props) {
  const [reason, setReason] = useState('')
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    panel.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'center',
    })
  }, [])
  return (
    <section ref={panel} className={styles.panel} aria-label="Nova proposta">
      <div className={styles.panelTitle}>
        <h2>Suspender participante</h2>
        <button className={styles.quiet} onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <details className={styles.eventLog}>
        <summary>Efeitos</summary>
        <p>O participante perde ações nesta árvore até o fim da suspensão.</p>
      </details>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(reason)
        }}
      >
        <label>
          Motivo público
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={3}
            maxLength={500}
            required
          />
        </label>
        <button className={styles.primary} disabled={busy || target.type !== 'ban'}>
          Registrar proposta
        </button>
      </form>
    </section>
  )
}