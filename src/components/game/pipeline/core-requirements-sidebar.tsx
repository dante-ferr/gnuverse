import type { PipelineFrame, PipelineRules } from './model/frame'
import styles from '../game-shell.module.css'

const resourceGlyph: Record<PipelineFrame['source']['shape'], string> = {
  circle: '/pipeline/resource-circle.svg',
}

type Props = {
  frame: PipelineFrame | null
  rules: PipelineRules | null
}

/** Delivery readouts for the central core (Jogo page). */
export function CoreRequirementsSidebar({ frame }: Props) {
  if (!frame?.seed) {
    return (
      <div className={styles.sidebarStats}>
        <p className={styles.controlsHint}>Abra ou crie uma sala para ver o progresso.</p>
      </div>
    )
  }

  return (
    <div className={styles.sidebarStats}>
      <h2 className={styles.sidebarSectionTitle}>Requisitos do núcleo</h2>
      <dl className={styles.coreRequirements}>
        <div>
          <dt>Versão</dt>
          <dd>v{frame.version}</dd>
        </div>
      </dl>
      <ul className={styles.coreRequirementGrid} aria-label="Formas exigidas">
        {frame.demands.map((demand) => {
          const glyph = resourceGlyph[demand.shape]
          const met = demand.received >= demand.required
          return (
            <li key={demand.shape} className={styles.coreRequirementCell}>
              <span
                className={styles.coreRequirementShapeGlyph}
                style={{
                  maskImage: `url(${glyph})`,
                  WebkitMaskImage: `url(${glyph})`,
                }}
                aria-hidden
              />
              <span
                className={`${styles.coreRequirementCount}${met ? ` ${styles.coreRequirementMet}` : ''}`}
              >
                {demand.received} / {demand.required}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
