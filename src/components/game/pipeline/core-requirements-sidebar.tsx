import type { PipelineFrame, PipelineRules } from './model/frame'
import { glyphUrlForShape } from './model/frame'
import styles from '../game-shell.module.css'

type Props = {
  frame: PipelineFrame | null
  rules: PipelineRules | null
}

/** Delivery readouts for the central core (Jogo page). */
export function CoreRequirementsSidebar({ frame, rules }: Props) {
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
          const glyph = glyphUrlForShape(rules, demand.shape) ?? '/pipeline/resource-circle.svg'
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
