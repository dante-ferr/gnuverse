'use client'

import type { FormEvent } from 'react'
import Link from 'next/link'
import styles from '../tower-game.module.css'
import authStyles from './auth-page.module.css'

export type AuthMode = 'login' | 'register'

export type AuthPanelProps = {
  mode: AuthMode
  busy: boolean
  returnTo: string
  error: string
  onSubmit: (form: HTMLFormElement) => void
}

export function AuthPanel({
  mode,
  busy,
  returnTo,
  error,
  onSubmit,
}: AuthPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(event.currentTarget)
  }

  return (
    <section className={`${styles.panel} ${authStyles.card}`} aria-labelledby="auth-title">
      <div className={styles.panelTitle}>
        <h1 id="auth-title">
          {mode === 'register' ? 'Criar conta' : 'Entrar'}
        </h1>
      </div>
      <p>{mode === 'register' ? 'Crie sua conta para construir com a comunidade.' : 'Entre na sua conta para continuar construindo.'}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <form className={`${styles.form} ${authStyles.form}`} onSubmit={handleSubmit} aria-busy={busy}>
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
      <Link className={styles.quiet} href={`${mode === 'register' ? '/login/' : '/cadastro/'}?next=${encodeURIComponent(returnTo)}`}>
        {mode === 'register' ? 'Já tenho uma conta' : 'Quero criar uma conta'}
      </Link>
      <details className={styles.eventLog}>
        <summary>Privacidade</summary>
        <p>O apelido é público. O e-mail fica privado.</p>
      </details>
      <Link className={styles.quiet} href={returnTo}>Voltar ao jogo</Link>
    </section>
  )
}
