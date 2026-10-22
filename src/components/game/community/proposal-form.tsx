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
        <h2>
          {target.type === 'restore'
            ? 'Restaurar versão'
            : 'Suspender participante'}
        </h2>
        <button className={styles.quiet} onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <details className={styles.eventLog}>
        <summary>Efeitos</summary>
        <p>
          {target.type === 'restore'
            ? 'A restauração não devolve moedas nem apaga o histórico.'
            : 'A suspensão vale só nesta torre. A conta, o saldo e as outras torres permanecem.'}
        </p>
      </details>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(reason)
        }}
      >
        <label className={styles.reason}>
          Motivo público
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={3}
            maxLength={500}
          />
        </label>
        <button className={styles.primary} disabled={busy}>
          Enviar
        </button>
      </form>
    </section>
  )
}
