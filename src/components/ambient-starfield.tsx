'use client'

import { usePathname } from 'next/navigation'
import styles from './ambient-starfield.module.css'

type AmbientStar = {
  x: number
  y: number
  size: number
  opacity: number
  cyan: boolean
  glow: boolean
  twinkleDuration?: number
  twinkleDelay?: number
}

function halton(index: number, base: number): number {
  let result = 0
  let f = 1 / base
  let i = index
  while (i > 0) {
    result += f * (i % base)
    i = Math.floor(i / base)
    f /= base
  }
  return result
}

const TWINKLE_DURATIONS = [2.6, 3.5, 4.4, 5.6, 6.8]

// Uniform full-width distribution (equal density and size mix across left,
// center and right); the CSS mask-image symmetrically quiets the center.
const ambientStars: AmbientStar[] = Array.from({ length: 130 }, (_, idx) => {
  const n = idx + 1
  const x = Number((1 + halton(n, 2) * 98).toFixed(2))
  const y = Number((1.5 + halton(n, 3) * 97).toFixed(2))
  const size = n % 13 === 0 ? 3 : n % 7 === 0 ? 2.5 : n % 2 === 0 ? 2 : 1.5
  const glow = size >= 2.5
  const opacity = Number((0.45 + halton(n, 5) * 0.5).toFixed(2))
  const cyan = n % 3 === 0
  const twinkles = n % 10 === 1 || n % 10 === 3 || n % 10 === 6 || n % 10 === 9
  if (!twinkles) {
    return { x, y, size, opacity, cyan, glow }
  }
  const twinkleDuration = TWINKLE_DURATIONS[idx % TWINKLE_DURATIONS.length]
  const twinkleDelay = Number((-((n * 1.29) % twinkleDuration)).toFixed(2))
  return { x, y, size, opacity, cyan, glow, twinkleDuration, twinkleDelay }
})

export function AmbientStarfield() {
  const pathname = usePathname()

  // Home renders its own StarChart; in-room game owns the full viewport canvas.
  if (pathname === '/' || pathname?.startsWith('/jogo/sala')) {
    return null
  }

  return (
    <div className={styles.backdrop} aria-hidden="true">
      {ambientStars.map((star, index) => (
        <span
          key={index}
          className={[
            styles.star,
            star.cyan ? styles.starCyan : styles.starWhite,
            star.glow ? styles.starGlow : '',
            star.twinkleDuration ? styles.twinkle : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            ...(star.twinkleDuration
              ? {
                  animationDuration: `${star.twinkleDuration}s`,
                  animationDelay: `${star.twinkleDelay}s`,
                }
              : { opacity: star.opacity }),
          }}
        />
      ))}
    </div>
  )
}
