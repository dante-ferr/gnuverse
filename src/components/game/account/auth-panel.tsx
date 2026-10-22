'use client'

import type { FormEvent } from 'react'
import styles from '../tower-game.module.css'

export type AuthMode = 'login' | 'register'

export type AuthPanelProps = {
  mode: AuthMode
  busy: boolean
  onClose: () => void
  onSubmit: (form: HTMLFormElement) => void
  onToggleMode: () => void
}

export function AuthPanel({
  mode,
  busy,
  onClose,
  onSubmit,
  onToggleMode,
}: AuthPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(event.currentTarget)
  }

  return (
    <section className={styles.panel} aria-label="Acesso ao jogo">
      <div className={styles.panelTitle}>
        <h2>
          {mode === 'register' ? 'Criar conta' : 'Entrar'}
        </h2>
        <button className={styles.quiet} onClick={onClose}>
          Fechar
        </button>
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        {mode === 'register' && (
          <label>
            Apelido público
            <input
              name="nickname"
              required
              minLength={3}
              maxLength={32}
              pattern="[\p{L}\p{N}_\-]+"
              title="Use letras, números, _ ou -"
              autoComplete="nickname"
            />
          </label>
        )}
        <label>
          E-mail
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
          />
        </label>
        <label>
          Senha
          <input
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete={
              mode === 'register' ? 'new-password' : 'current-password'
            }
          />
        </label>
        <button className={styles.primary} disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'register' ? 'Criar conta' : 'Entrar'}
        </button>
      </form>
      <button className={styles.quiet} onClick={onToggleMode}>
        {mode === 'register' ? 'Já tenho uma conta' : 'Quero criar uma conta'}
      </button>
      <details className={styles.eventLog}>
        <summary>Privacidade</summary>
        <p>O apelido é público. O e-mail fica privado.</p>
      </details>
    </section>
  )
}
