'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import styles from '../game-shell.module.css'
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
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!busy) {
      setSlow(false)
      return
    }
    const timer = setTimeout(() => setSlow(true), 3000)
    return () => clearTimeout(timer)
  }, [busy])

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
      <p>{mode === 'register' ? 'Crie sua conta do GNUverse. Se você já tem uma conta no painel, use Entrar.' : 'Use sua conta do GNUverse. Entre com o e-mail ou o apelido público e a senha.'}</p>
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
              autoComplete="username"
            />
          </label>
        )}
        <label>
          {mode === 'register' ? 'E-mail' : 'E-mail ou apelido'}
          <input
            name="email"
            type={mode === 'register' ? 'email' : 'text'}
            required
            minLength={mode === 'register' ? undefined : 3}
            maxLength={254}
            autoComplete={mode === 'register' ? 'email' : 'username'}
          />
        </label>
        <label>
          Senha
          <input
            name="password"
            type="password"
            required
            minLength={1}
            maxLength={128}
            autoComplete={
              mode === 'register' ? 'new-password' : 'current-password'
            }
          />
        </label>
        <button className={styles.primary} disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'register' ? 'Criar conta' : 'Entrar'}
        </button>
        {busy && slow && (
          <p className={styles.message} role="status">
            Conectando ao servidor de contas… O primeiro acesso após alguns minutos sem uso pode levar até um minuto.
          </p>
        )}
      </form>
      <Link className={styles.quiet} href={`${mode === 'register' ? '/login/' : '/cadastro/'}?next=${encodeURIComponent(returnTo)}`}>
        {mode === 'register' ? 'Já tenho uma conta' : 'Quero criar uma conta'}
      </Link>
      {mode === 'login' && (
        <Link className={styles.quiet} href="/recuperar-senha/">
          Esqueci minha senha
        </Link>
      )}
      <details className={styles.eventLog}>
        <summary>Privacidade</summary>
        <p>O apelido é público. O e-mail fica privado.</p>
      </details>
      <Link className={styles.quiet} href={returnTo}>
        {returnTo.startsWith('/blog') || returnTo.startsWith('/artigos')
          ? 'Voltar ao blog'
          : 'Voltar ao jogo'}
      </Link>
    </section>
  )
}
