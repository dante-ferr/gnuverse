'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import styles from './star-chart.module.css'

/**
 * Home hero with an interactive celestial chart of free-software milestones.
 * Visuals (deep starfield, concentric celestial arcs, constellation lines,
 * dots, rings, labels) live in a decorative SVG; occasional shooting stars
 * animate in an isolated overlay; keyboard and pointer interaction uses native
 * HTML buttons overlaid on each star's percentage coordinates.
 */

type Star = {
  id: string
  label: string
  year: number
  x: number
  y: number
  blurb: string
  /** Core milestones get a larger dot and a concentric ring. */
  core?: boolean
  /** Anchor the label on the left of the dot (for stars near the right edge). */
  flip?: boolean
}

const stars: Star[] = [
  {
    id: 'gnu',
    label: 'GNU',
    year: 1983,
    x: 70,
    y: 12,
    core: true,
    blurb:
      'Richard Stallman anuncia o projeto GNU para criar um sistema operacional inteiramente livre.',
  },
  {
    id: 'gcc',
    label: 'GCC',
    year: 1987,
    x: 86,
    y: 18,
    blurb: 'O compilador do GNU tornou possível construir software livre usando apenas ferramentas livres.',
  },
  {
    id: 'gplv3',
    label: 'GPLv3',
    year: 2007,
    x: 79,
    y: 32,
    core: true,
    blurb:
      'Terceira versão da GPL: reforça o copyleft contra travas de hardware e ameaças de patentes.',
  },
  {
    id: 'linux',
    label: 'Linux',
    year: 1991,
    x: 65,
    y: 48,
    core: true,
    blurb:
      'Linus Torvalds publica o kernel que, unido às ferramentas GNU, completa um sistema operacional livre.',
  },
  {
    id: 'git',
    label: 'Git',
    year: 2005,
    x: 77,
    y: 62,
    blurb: 'Criado para desenvolver o Linux, tornou a colaboração distribuída o padrão dos projetos abertos.',
  },
  {
    id: 'debian',
    label: 'Debian',
    year: 1993,
    x: 92,
    y: 42,
    flip: true,
    blurb: 'Distribuição mantida por voluntários e guiada por um contrato social com seus usuários.',
  },
  {
    id: 'firefox',
    label: 'Firefox',
    year: 2004,
    x: 95,
    y: 64,
    flip: true,
    blurb: 'Navegador livre da Mozilla que quebrou o monopólio dos navegadores e defendeu a web aberta.',
  },
  {
    id: 'vlc',
    label: 'VLC',
    year: 2001,
    x: 86,
    y: 76,
    flip: true,
    blurb: 'Reprodutor multimídia livre que toca praticamente qualquer formato, em qualquer sistema.',
  },
  {
    id: 'blender',
    label: 'Blender',
    year: 2002,
    x: 64,
    y: 82,
    blurb: 'Liberado após uma campanha coletiva de doações, virou referência em criação 3D livre.',
  },
  {
    id: 'python',
    label: 'Python',
    year: 1991,
    x: 54,
    y: 88,
    blurb: 'Linguagem aberta e legível que popularizou a programação no ensino e na ciência.',
  },
]

/** Constellation lines between related milestones. */
const links: [string, string][] = [
  ['gnu', 'gcc'],
  ['gnu', 'gplv3'],
  ['gcc', 'gplv3'],
  ['gnu', 'linux'],
  ['linux', 'git'],
  ['linux', 'debian'],
  ['debian', 'firefox'],
  ['debian', 'vlc'],
  ['git', 'blender'],
  ['blender', 'python'],
]

/** Unlabeled background stars (140), generated deterministically via a Halton
 * sequence so distribution looks organic without SSR hydration mismatches. */
type FieldStar = {
  x: number
  y: number
  /** SVG radius in px (0.5 => 1px, 0.75 => 1.5px, 1 => 2px diameter). */
  r: number
  /** Base opacity in 0.25..0.78 for static stars. */
  opacity: number
  /** Tint a subset of stars with light cyan to echo the GNUverse logo. */
  cyan: boolean
  /** Left-side stars behind the hero headline stay slightly subtler. */
  dim: boolean
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

const TWINKLE_DURATIONS = [3.1, 4.3, 5.7, 6.9, 8.3]

const field: FieldStar[] = Array.from({ length: 140 }, (_, idx) => {
  const n = idx + 1
  const x = Number((1.5 + halton(n, 2) * 97).toFixed(2))
  const y = Number((2 + halton(n, 3) * 96).toFixed(2))
  const r = n % 6 === 0 ? 1 : n % 3 === 0 ? 0.75 : 0.5
  const opacity = Number((0.25 + halton(n, 5) * 0.55).toFixed(2))
  const cyan = n % 4 === 0
  const dim = x < 46 && y > 18 && y < 82
  const twinkles = n % 10 === 1 || n % 10 === 4 || n % 10 === 7 || n % 10 === 9
  if (!twinkles) {
    return { x, y, r, opacity, cyan, dim }
  }
  const twinkleDuration = TWINKLE_DURATIONS[idx % TWINKLE_DURATIONS.length]
  const twinkleDelay = Number((-((n * 1.43) % twinkleDuration)).toFixed(2))
  return { x, y, r, opacity, cyan, dim, twinkleDuration, twinkleDelay }
})

/** Concentric celestial chart arcs centered on the constellation region. */
const arcs = [
  { r: '15%', dash: '230 130', offset: '35', opacity: 0.28 },
  { r: '27%', dash: '255 105', offset: '165', opacity: 0.25 },
  { r: '40%', dash: '215 145', offset: '290', opacity: 0.22 },
]

type ShootingStar = {
  id: number
  left: number
  top: number
  angle: number
  length: number
  travel: number
  duration: number
}

const MAX_SHOOTING_STARS = 2
const FIRST_SHOOT_MIN_MS = 1800
const FIRST_SHOOT_MAX_MS = 3500
const SHOOT_INTERVAL_MIN_MS = 4000
const SHOOT_INTERVAL_MAX_MS = 10000

/** Nodes right of this x (%) open the tooltip towards the left. */
const ALIGN_END_FROM_X = 66
/** Nodes below this y (%) open the tooltip upwards. */
const OPEN_ABOVE_FROM_Y = 55

const byId = new Map(stars.map((star) => [star.id, star]))
const pct = (value: number) => `${value}%`
const TOOLTIP_ID = 'star-chart-tooltip'

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function StarChart({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer: number | undefined
    let nextId = 1

    const scheduleNext = (minMs: number, maxMs: number) => {
      if (mediaQuery.matches) return
      const delay = randomBetween(minMs, maxMs)
      timer = window.setTimeout(() => {
        if (mediaQuery.matches) return
        const star: ShootingStar = {
          id: nextId++,
          left: Math.round(randomBetween(12, 78)),
          top: Math.round(randomBetween(4, 48)),
          angle: Math.round(randomBetween(26, 38)),
          length: Math.round(randomBetween(95, 165)),
          travel: Math.round(randomBetween(240, 380)),
          duration: Number(randomBetween(0.85, 1.35).toFixed(2)),
        }
        setShootingStars((prev) =>
          prev.length >= MAX_SHOOTING_STARS ? [...prev.slice(1), star] : [...prev, star],
        )
        scheduleNext(SHOOT_INTERVAL_MIN_MS, SHOOT_INTERVAL_MAX_MS)
      }, delay)
    }

    const handleMotionChange = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer)
        timer = undefined
      }
      if (mediaQuery.matches) {
        setShootingStars([])
      } else {
        scheduleNext(FIRST_SHOOT_MIN_MS, FIRST_SHOOT_MAX_MS)
      }
    }

    if (!mediaQuery.matches) {
      scheduleNext(FIRST_SHOOT_MIN_MS, FIRST_SHOOT_MAX_MS)
    }
    mediaQuery.addEventListener('change', handleMotionChange)

    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      mediaQuery.removeEventListener('change', handleMotionChange)
    }
  }, [])

  const active = activeId ? (byId.get(activeId) ?? null) : null
  const connected = new Set(
    links.filter(([a, b]) => a === activeId || b === activeId).flat(),
  )

  const tooltipClass = active
    ? [
        styles.tooltip,
        active.x >= ALIGN_END_FROM_X ? styles.alignEnd : styles.alignStart,
        active.y >= OPEN_ABOVE_FROM_Y ? styles.above : styles.below,
      ].join(' ')
    : ''

  return (
    <section
      className={`${styles.hero}${active ? ` ${styles.hasActive}` : ''}`}
      aria-labelledby="home-title"
    >
      <svg className={styles.sky} width="100%" height="100%" aria-hidden="true" focusable="false">
        <g className={styles.arcs}>
          {arcs.map((arc) => (
            <circle
              key={arc.r}
              cx="76%"
              cy="50%"
              r={arc.r}
              pathLength={360}
              strokeDasharray={arc.dash}
              strokeDashoffset={arc.offset}
              style={{ opacity: arc.opacity }}
            />
          ))}
        </g>
        <g className={styles.field}>
          {field
            .filter((star) => !star.dim)
            .map((star, index) => (
              <circle
                key={`r-${index}`}
                cx={pct(star.x)}
                cy={pct(star.y)}
                r={star.r}
                className={[
                  star.cyan ? styles.starCyan : styles.starWhite,
                  star.twinkleDuration ? styles.twinkle : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  star.twinkleDuration
                    ? {
                        animationDuration: `${star.twinkleDuration}s`,
                        animationDelay: `${star.twinkleDelay}s`,
                      }
                    : { opacity: star.opacity }
                }
              />
            ))}
        </g>
        <g className={`${styles.field} ${styles.fieldDim}`}>
          {field
            .filter((star) => star.dim)
            .map((star, index) => (
              <circle
                key={`l-${index}`}
                cx={pct(star.x)}
                cy={pct(star.y)}
                r={star.r}
                className={[
                  star.cyan ? styles.starCyan : styles.starWhite,
                  star.twinkleDuration ? styles.twinkle : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  star.twinkleDuration
                    ? {
                        animationDuration: `${star.twinkleDuration}s`,
                        animationDelay: `${star.twinkleDelay}s`,
                      }
                    : { opacity: star.opacity }
                }
              />
            ))}
        </g>
        <g className={styles.links}>
          {links.map(([from, to]) => {
            const a = byId.get(from)!
            const b = byId.get(to)!
            const lit = from === activeId || to === activeId
            return (
              <line
                key={`${from}-${to}`}
                className={lit ? styles.linkActive : undefined}
                x1={pct(a.x)}
                y1={pct(a.y)}
                x2={pct(b.x)}
                y2={pct(b.y)}
              />
            )
          })}
        </g>
        <g>
          {stars.map((star) => {
            const isActive = star.id === activeId
            const isNeighbor = !isActive && connected.has(star.id)
            const stateClass = isActive
              ? styles.nodeActive
              : isNeighbor
                ? styles.nodeNeighbor
                : ''
            return (
              <g
                key={star.id}
                className={`${styles.node} ${star.core ? styles.core : ''} ${stateClass}`}
              >
                {star.core && (
                  <circle className={styles.ring} cx={pct(star.x)} cy={pct(star.y)} r={7} />
                )}
                <circle
                  className={styles.dot}
                  cx={pct(star.x)}
                  cy={pct(star.y)}
                  r={star.core ? 2.5 : 1.5}
                />
                <text
                  className={styles.label}
                  x={pct(star.x)}
                  y={pct(star.y)}
                  dx={star.flip ? -12 : 12}
                  dy={4}
                  textAnchor={star.flip ? 'end' : 'start'}
                >
                  {star.label} <tspan className={styles.year}>{star.year}</tspan>
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {shootingStars.length > 0 && (
        <div className={styles.shootingLayer} aria-hidden="true">
          {shootingStars.map((star) => (
            <span
              key={star.id}
              className={styles.shootingStar}
              style={
                {
                  left: pct(star.left),
                  top: pct(star.top),
                  width: `${star.length}px`,
                  '--angle': `${star.angle}deg`,
                  '--travel': `${star.travel}px`,
                  animationDuration: `${star.duration}s`,
                } as CSSProperties
              }
              onAnimationEnd={() =>
                setShootingStars((prev) => prev.filter((item) => item.id !== star.id))
              }
            />
          ))}
        </div>
      )}

      <div className={styles.inner}>
        <div className={styles.copy}>{children}</div>
        <p className={styles.hint} aria-hidden={active ? true : undefined}>
          Passe o mouse ou use Tab nos astros para explorar
        </p>
      </div>

      <div
        className={styles.hotspots}
        role="group"
        aria-label="Marcos do software livre na carta celeste"
      >
        {stars.map((star) => {
          const isActive = star.id === activeId
          return (
            <button
              key={star.id}
              type="button"
              className={styles.hotspot}
              style={{ left: pct(star.x), top: pct(star.y) }}
              aria-label={`${star.label}, ${star.year}`}
              aria-describedby={isActive ? TOOLTIP_ID : undefined}
              onMouseEnter={() => setActiveId(star.id)}
              onMouseLeave={() => setActiveId((prev) => (prev === star.id ? null : prev))}
              onFocus={() => setActiveId(star.id)}
              onBlur={() => setActiveId((prev) => (prev === star.id ? null : prev))}
              onClick={() => setActiveId(star.id)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setActiveId(null)
                }
              }}
            />
          )
        })}
      </div>

      {active && (
        <div
          id={TOOLTIP_ID}
          role="tooltip"
          className={tooltipClass}
          style={{ '--x': pct(active.x), '--y': pct(active.y) } as CSSProperties}
        >
          <p className={styles.tooltipHead}>
            <strong>{active.label}</strong>
            <span className={styles.tooltipYear}>{active.year}</span>
          </p>
          <p className={styles.tooltipText}>{active.blurb}</p>
        </div>
      )}
    </section>
  )
}
