'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import styles from './star-chart.module.css'

/**
 * Home hero with an interactive celestial chart of free-software milestones.
 * Visuals (field stars, constellation lines, dots, rings, labels) live in a
 * purely decorative SVG; keyboard and pointer interaction is handled by native
 * HTML buttons overlaid on each star's percentage coordinates so Tab focus,
 * :focus-visible, and hover work reliably across browsers without being
 * blocked by the hero layout grid.
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

/** Unlabeled background stars, kept on the edges and away from the headline. */
const field: [number, number][] = [
  [4, 8], [11, 5], [24, 4], [38, 6], [52, 5], [59, 10], [93, 7], [97, 28],
  [61, 30], [88, 33], [57, 64], [72, 74], [98, 52], [44, 92], [30, 95],
  [17, 91], [6, 84], [2, 62], [3, 32], [82, 48], [71, 40], [56, 94],
]

/** Indices of field stars that twinkle (disabled under reduced motion). */
const twinkle = new Set([1, 4, 6, 9, 11, 14, 17, 20])

/** Nodes right of this x (%) open the tooltip towards the left. */
const ALIGN_END_FROM_X = 66
/** Nodes below this y (%) open the tooltip upwards. */
const OPEN_ABOVE_FROM_Y = 55

const byId = new Map(stars.map((star) => [star.id, star]))
const pct = (value: number) => `${value}%`
const TOOLTIP_ID = 'star-chart-tooltip'

export function StarChart({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null)
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
        <g className={styles.field}>
          {field.map(([x, y], index) => (
            <circle
              key={`${x}-${y}`}
              cx={pct(x)}
              cy={pct(y)}
              r={1}
              className={twinkle.has(index) ? styles.twinkle : undefined}
              style={twinkle.has(index) ? { animationDelay: `${index * -0.9}s` } : undefined}
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
