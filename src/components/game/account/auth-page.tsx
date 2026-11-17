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
    const search = new URLSearchParams(window.location.search)
    const next = search.get('next')
    if (search.get('notice') === 'login-required') {
      setNotice(
        next?.startsWith('/blog')
          ? 'Entre na sua conta para contribuir com um artigo. Depois do login, você voltará ao blog.'
          : 'Entre na sua conta para criar ou entrar em uma caverna. Depois do login, você voltará ao jogo.',
      )
    }
    if (!next) return
    try {
      const destination = new URL(next, window.location.origin)
      if (
        destination.origin === window.location.origin &&
        (destination.pathname === '/jogo' ||
          destination.pathname.startsWith('/jogo/') ||
          destination.pathname === '/blog' ||
          destination.pathname.startsWith('/blog/') ||
          destination.pathname === '/artigos' ||
          destination.pathname.startsWith('/artigos/'))
      ) {
        setReturnTo(destination.pathname + destination.search + destination.hash)
      }
    } catch {
      // Invalid return addresses fall back to the game dashboard.
    }
  }, [])

  const authenticate = (form: HTMLFormElement) =>
    feedback.run(async () => {
      const outcome = await session.authenticate(mode, form)
      if (!outcome.verificationRequired) router.replace(returnTo)
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
      {(notice || session.notice) && (
        <p className={styles.message} role="status">{session.notice || notice}</p>
      )}
    </main>
  )
}
