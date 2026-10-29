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

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next')
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
    </main>
  )
}
