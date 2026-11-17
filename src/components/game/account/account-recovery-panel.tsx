'use client'

import type { FormEvent, ReactNode } from 'react'
import Link from 'next/link'
import { GameApi } from '../api/game-api'
import styles from '../game-shell.module.css'
import authStyles from './auth-page.module.css'

type RecoveryPanelProps = {
  title: string
  description: string
  busy: boolean
  error: string
  notice: string
  onSubmit: (form: HTMLFormElement) => void
  children?: ReactNode
}

export function RecoveryPanel({
  title,
  description,
  busy,
  error,
  notice,
  onSubmit,
  children,
}: RecoveryPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(event.currentTarget)
  }

  return (
    <section className={`${styles.panel} ${authStyles.card}`} aria-labelledby="recovery-title">
      <div className={styles.panelTitle}>
        <h1 id="recovery-title">{title}</h1>
      </div>
      <p>{description}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.message} role="status">{notice}</p>}
      <form className={`${styles.form} ${authStyles.form}`} onSubmit={handleSubmit} aria-busy={busy}>
        {children}
      </form>
      <Link className={styles.quiet} href="/login/">Voltar para entrar</Link>
    </section>
  )
}

export function usePublicGameApi() {
  return new GameApi('', () => {})
}