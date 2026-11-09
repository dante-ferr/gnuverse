'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthPanel, type AuthMode } from './auth-panel'
import { useGameSession } from '../hooks/use-game-session'
import { useActionFeedback } from '../hooks/use-action-feedback'
import styles from '../tower-game.module.css'
import authStyles from './auth-page.module.css'

export function AuthPage({ mode }: { mode: AuthMode }) {
  const session = useGameSession()
  const feedback = useActionFeedback()
  const router = useRouter()
  const [returnTo, setReturnTo] = useState('/jogo/')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next')
    if (new URLSearchParams(window.location.search).get('notice') === 'login-required') {
      setNotice('Entre na sua conta para criar uma torre. Depois do login, você voltará para a criação.')
    }
    if (!next) return
    try {
      const destination = new URL(next, window.location.origin)
      if (
        destination.origin === window.location.origin &&
        (destination.pathname === '/jogo' || destination.pathname.startsWith('/jogo/'))
      ) {
        setReturnTo(destination.pathname + destination.search + destination.hash)
      }
    } catch {
      // Invalid return addresses fall back to the game dashboard.
    }
  }, [])

  const authenticate = (form: HTMLFormElement) =>
    feedback.run(async () => {
      await session.authenticate(mode, form)
      router.replace(returnTo)
    })

  return (
    <main className={`${styles.game} ${authStyles.page}`}>
      <AuthPanel
        mode={mode}
        busy={feedback.busy}
        error={feedback.error}
        returnTo={returnTo}
        onSubmit={authenticate}
      />
      {notice && <p className={styles.message} role="status">{notice}</p>}
    </main>
  )
}
