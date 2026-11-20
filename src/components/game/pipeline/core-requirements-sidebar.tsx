'use client'

import { useState } from 'react'
import type { PipelineFrame, PipelineRules } from './model/frame'
import { glyphUrlForShape } from './model/frame'
import { ProductionLineOverlay } from './production-line/production-line-overlay'
import styles from '../game-shell.module.css'

type Props = {
  frame: PipelineFrame | null
  rules: PipelineRules | null
}

const countFormat = new Intl.NumberFormat('pt-BR')

function formatCount(n: number): string {
  return countFormat.format(n)
}

/** Delivery readouts for the central core (Jogo page). */
export function CoreRequirementsSidebar({ frame, rules }: Props) {
  const [selectedShape, setSelectedShape] = useState<string | null>(null)

  if (!frame?.seed) {
    return (
      <div className={styles.sidebarStats}>
        <p className={styles.controlsHint}>Abra ou crie uma sala para ver o progresso.</p>
      </div>
    )
  }

  const wave = frame.escalationWave ?? 0
  const lastChapter = rules?.elements.chapters.length ?? 0
  const onLastChapter = (frame.chapter ?? 0) >= lastChapter && lastChapter > 0

  return (
    <div className={styles.sidebarStats}>
      <h2 className={styles.sidebarSectionTitle}>Requisitos do núcleo</h2>
      <dl className={styles.coreRequirements}>
        <div>
          <dt>Capítulo</dt>
          <dd>{frame.chapter ?? frame.version.replace(/^0\./, '')}</dd>
        </div>
        {wave > 0 ? (
          <div>
            <dt>Onda</dt>
            <dd>{formatCount(wave)}</dd>
          </div>
        ) : null}
        {onLastChapter || wave > 0 ? (
          <div>
            <dt>Pontuação</dt>
            <dd>{formatCount(frame.deliveries)}</dd>
          </div>
        ) : null}
      </dl>
      <ul className={styles.coreRequirementGrid} aria-label="Formas exigidas">
        {frame.demands.map((demand) => {
          const glyph = glyphUrlForShape(rules, demand.shape) ?? '/pipeline/resource-circle.svg'
          const element = rules?.elements.elements.find((el) => el.id === demand.shape)
          const met = demand.received >= demand.required
          const progress =
            demand.required > 0
              ? Math.min(1, Math.max(0, demand.received / demand.required))
              : met
                ? 1
                : 0
          const name =
            element?.name_pt ?? (demand.shape === 'circle' ? 'Círculo' : demand.shape)
          const glyphColor = element?.fill ?? rules?.colorPacket ?? undefined
          return (
            <li key={demand.shape} className={styles.coreRequirementCell}>
              <button
                type="button"
                className={styles.coreRequirementButton}
                onClick={() => setSelectedShape(demand.shape)}
                aria-label={`Ver linha de produção de ${name}: ${formatCount(demand.received)} de ${formatCount(demand.required)}`}
              >
                <span
                  className={styles.coreRequirementShapeGlyph}
                  style={{
                    maskImage: `url(${glyph})`,
                    WebkitMaskImage: `url(${glyph})`,
                    ...(glyphColor ? { backgroundColor: glyphColor } : {}),
                  }}
                  aria-hidden
                />
                <span className={styles.coreRequirementCount} aria-hidden>
                  {formatCount(demand.received)} / {formatCount(demand.required)}
                </span>
                <span
                  className={`${styles.coreRequirementBar}${met ? ` ${styles.coreRequirementBarMet}` : ''}`}
                  aria-hidden
                >
                  <span
                    className={styles.coreRequirementBarFill}
                    style={{
                      width: `${progress * 100}%`,
                      ...(glyphColor ? { backgroundColor: glyphColor } : {}),
                    }}
                  />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {selectedShape ? (
        <ProductionLineOverlay
          shape={selectedShape}
          catalog={rules?.elements}
          onClose={() => setSelectedShape(null)}
        />
      ) : null}
    </div>
  )
}
