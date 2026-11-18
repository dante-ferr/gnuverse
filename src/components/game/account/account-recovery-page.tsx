'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RecoveryPanel, usePublicGameApi } from './account-recovery-panel'
import { useActionFeedback } from '../hooks/use-action-feedback'
import styles from '../game-shell.module.css'
import authStyles from './auth-page.module.css'

type Mode = 'forgot' | 'reset' | 'verify'

export function AccountRecoveryPage({
  mode,
  title,
  description,
}: {
  mode: Mode
  title: string
  description: string
}) {
  const feedback = useActionFeedback()
  const router = useRouter()
  const params = useSearchParams()
  const api = useMemo(() => usePublicGameApi(), [])
  const token = params.get('token')?.trim() ?? ''
  const [tokenError, setTokenError] = useState('')

  useEffect(() => {
    if (mode !== 'verify' || !token) return
    const storageKey = `gnuverse-verify-email:${token}`
    try {
      if (sessionStorage.getItem(storageKey) === 'ok') {
        feedback.setNotice('E-mail confirmado. Agora você já pode entrar.')
        return
      }
      if (sessionStorage.getItem(storageKey) === 'pending') return
      sessionStorage.setItem(storageKey, 'pending')
    } catch {
      /* sessionStorage may be unavailable; the server confirm path is idempotent. */
    }
    void feedback.run(async () => {
      try {
        const result = await api.request<{ message: string }>(
          `/api/verify-email/${encodeURIComponent(token)}`,
          {},
        )
        try {
          sessionStorage.setItem(storageKey, 'ok')
        } catch {
          /* Keep the success notice in memory. */
        }
        feedback.setNotice(result.message)
      } catch (error) {
        try {
          sessionStorage.removeItem(storageKey)
        } catch {
          /* Ignore storage failures while surfacing the API error. */
        }
        throw error
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token])

  useEffect(() => {
    if (mode === 'reset' && !token) setTokenError('O link de redefinição está incompleto. Solicite um novo e-mail.')
    if (mode === 'verify' && !token) setTokenError('O link de confirmação está incompleto.')
  }, [mode, token])

  const submitForgot = (form: HTMLFormElement) =>
    feedback.run(async () => {
      const data = new FormData(form)
      const result = await api.request<{ message: string }>('/api/forgot-password', {
        email: data.get('email'),
      })
      feedback.setNotice(result.message)
    })

  const submitReset = (form: HTMLFormElement) =>
    feedback.run(async () => {
      const data = new FormData(form)
      const result = await api.request<{ message: string }>('/api/reset-password', {
        token,
        password: data.get('password'),
      })
      feedback.setNotice(result.message)
      router.replace('/login/')
    })

  return (
    <main className={`${styles.game} ${authStyles.page}`}>
      <RecoveryPanel
        title={title}
        description={description}
        busy={feedback.busy}
        error={tokenError || feedback.error}
        notice={feedback.notice}
        onSubmit={
          mode === 'forgot' ? submitForgot : mode === 'reset' ? submitReset : () => {}
        }
      >
        {mode === 'forgot' && (
          <label>
            E-mail
            <input name="email" type="email" required maxLength={254} autoComplete="email" />
          </label>
        )}
        {mode === 'reset' && token && (
          <label>
            Nova senha
            <input
              name="password"
              type="password"
              required
              minLength={1}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
        )}
        {(mode === 'forgot' || (mode === 'reset' && token)) && (
          <button className={styles.primary} disabled={feedback.busy} type="submit">
            {feedback.busy ? 'Aguarde…' : mode === 'forgot' ? 'Enviar link' : 'Salvar nova senha'}
          </button>
        )}
      </RecoveryPanel>
    </main>
  )
}