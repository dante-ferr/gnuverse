'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authenticateViaCms, resolveCmsBaseUrl } from '@/lib/cms-client'
import { resolveGameApiUrl } from '../api/game-api'
import { warmAuthBackends } from '../api/warmup'
import { AuthPanel, type AuthMode } from './auth-panel'
import { useGameSession } from '../hooks/use-game-session'
import { useActionFeedback } from '../hooks/use-action-feedback'
import styles from '../game-shell.module.css'
import authStyles from './auth-page.module.css'

export function AuthPage({ mode }: { mode: AuthMode }) {
  const session = useGameSession()
  const feedback = useActionFeedback()
  const router = useRouter()
  const [returnTo, setReturnTo] = useState('/jogo/')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    warmAuthBackends()
    const search = new URLSearchParams(window.location.search)
    const next = search.get('next')
    if (search.get('notice') === 'login-required') {
      setNotice(
        next?.startsWith('/quizzes')
          ? 'Entre na sua conta para criar quizzes. Depois do login, você voltará aos quizzes.'
          : next?.startsWith('/blog')
            ? 'Entre na sua conta para contribuir com um artigo. Depois do login, você voltará ao blog.'
            : 'Entre na sua conta para criar ou entrar em uma sala. Depois do login, você voltará ao jogo.',
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
          destination.pathname.startsWith('/artigos/') ||
          destination.pathname === '/quizzes' ||
          destination.pathname.startsWith('/quizzes/'))
      ) {
        setReturnTo(destination.pathname + destination.search + destination.hash)
      }
    } catch {
      // Invalid return addresses fall back to the game dashboard.
    }
  }, [])

  const authenticate = (form: HTMLFormElement) =>
    feedback.run(async () => {
      const useCmsDirect =
        returnTo.startsWith('/blog') ||
        returnTo.startsWith('/artigos') ||
        returnTo.startsWith('/quizzes') ||
        !resolveGameApiUrl()
      if (useCmsDirect) {
        const cmsUrl = resolveCmsBaseUrl()
        if (!cmsUrl) {
          throw new Error(
            'O servidor editorial (CMS) ainda não foi configurado neste ambiente.',
          )
        }
        const data = new FormData(form)
        const outcome = await authenticateViaCms(cmsUrl, mode, {
          email: String(data.get('email') || ''),
          password: String(data.get('password') || ''),
          nickname:
            mode === 'register' ? String(data.get('nickname') || '') : undefined,
        })
        if (outcome.verificationRequired) {
          setNotice(outcome.message)
          return
        }
        session.setSessionToken(outcome.token, data.get('remember') === 'on')
        router.replace(returnTo)
        return
      }
      const outcome = await session.authenticate(mode, form, new FormData(form).get('remember') === 'on')
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
