'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useGameSession } from '@/components/game/hooks/use-game-session'
import { resolveGameApiUrl } from '@/components/game/api/game-api'
import { rewardsApi, type ArticleOpenResult } from '@/lib/rewards-client'

type Phase =
  | { name: 'idle' }
  | { name: 'reading'; offer: ArticleOpenResult }
  | { name: 'claimed'; awarded: number }
  | { name: 'error'; message: string }

/**
 * Pays reading coins once the signed-in reader has spent the minimum time on the page
 * and reached the end. The server enforces the timer, ownership and once-per-article rule.
 */
export function ArticleReadReward({ slug }: { slug: string }) {
  const { api, token, setWallet } = useGameSession()
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const [timeUp, setTimeUp] = useState(false)
  const [atEnd, setAtEnd] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const enabled = Boolean(token) && Boolean(resolveGameApiUrl())

  useEffect(() => {
    if (!enabled) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    setTimeUp(false)
    rewardsApi
      .openArticle(api, slug)
      .then((offer) => {
        if (!active) return
        if (offer.claimed) return setPhase({ name: 'claimed', awarded: 0 })
        setPhase({ name: 'reading', offer })
        timer = setTimeout(() => setTimeUp(true), offer.minSeconds * 1000 + 500)
      })
      .catch(() => {
        if (active) setPhase({ name: 'idle' })
      })
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [api, enabled, slug])

  useEffect(() => {
    const node = endRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setAtEnd(true)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const reading = phase.name === 'reading'
  useEffect(() => {
    if (!reading || !timeUp || !atEnd) return
    let active = true
    rewardsApi
      .claimArticle(api, slug)
      .then((result) => {
        if (!active) return
        setWallet(result.wallet)
        setPhase({ name: 'claimed', awarded: result.awarded })
      })
      .catch((error: Error) => {
        if (active) setPhase({ name: 'error', message: error.message })
      })
    return () => {
      active = false
    }
  }, [reading, timeUp, atEnd, api, slug, setWallet])

  let message: React.ReactNode = null
  if (!token)
    message = (
      <>
        <Link href="/login/" className="text-[var(--accent)] underline underline-offset-4">
          Entre
        </Link>{' '}
        para ganhar moedas do jogo lendo este artigo.
      </>
    )
  else if (phase.name === 'reading')
    message = `Leia até o fim para ganhar ${phase.offer.coins} moedas.`
  else if (phase.name === 'claimed')
    message = phase.awarded
      ? `Leitura concluída: +${phase.awarded} moedas de recompensa!`
      : 'Você já recebeu a recompensa deste artigo.'
  else if (phase.name === 'error') message = phase.message

  return (
    <div ref={endRef} className="mt-12" aria-live="polite">
      {message && (
        <p className="rounded-sm border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
          {message}
        </p>
      )}
    </div>
  )
}
