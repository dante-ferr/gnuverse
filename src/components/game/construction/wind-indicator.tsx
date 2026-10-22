'use client'

import { useEffect, useState } from 'react'
import type { WindState } from '../model/types'
import styles from '../tower-game.module.css'

export function WindIndicator({
  wind,
}: {
  wind: WindState | null | undefined
}) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (wind?.phase !== 'active') return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(timer)
  }, [wind?.phase, wind?.endsAt])
  if (!wind) return null
  return (
    <span className={styles.windStatus} role="status">
      {wind.phase === 'pending'
        ? 'Vento em breve'
        : wind.phase === 'settling'
          ? 'Estabilizando'
          : `Ventania · ${Math.min(5, Math.max(0, Math.ceil(((wind.endsAt || now) - now) / 1000)))}s`}
    </span>
  )
}

export function WindStreaks({ direction }: { direction: 1 | -1 }) {
  return (
    <g
      className={styles.windStreaks}
      aria-hidden="true"
      transform={direction === -1 ? 'translate(1000 0) scale(-1 1)' : undefined}
    >
      {Array.from({ length: 12 }, (_, index) => (
        <path
          key={index}
          d={`M${-200 + ((index * 137) % 800)} ${110 + index * 47}h${75 + (index % 4) * 25}`}
          style={{ animationDelay: `${-index * 0.13}s` }}
        />
      ))}
    </g>
  )
}
