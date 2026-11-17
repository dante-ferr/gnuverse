import type { PipelineFrame, PipelineRules } from './model/frame'
import styles from '../game-shell.module.css'

const resourceGlyph: Record<PipelineFrame['source']['shape'], string> = {
  circle: '/pipeline/resource-circle.svg',
}

type Props = {
  frame: PipelineFrame | null
  rules: PipelineRules | null
}

/** Compact unlock / delivery readouts for the central core. */
export function CoreRequirementsSidebar({ frame, rules }: Props) {
  if (!frame?.seed) {
    return (
      <div className={styles.sidebarStats}>
        <p className={styles.controlsHint}>Abra ou crie uma sala para ver o progresso.</p>
      </div>
    )
  }

  const unlockTarget = rules?.unlockCollaborators ?? 2
  const collaboratorCount = frame.collaborators.length

  return (
    <div className={styles.sidebarStats}>
      <dl className={styles.coreRequirements}>
        <div>
          <dt>Versão</dt>
          <dd>v{frame.version}</dd>
        </div>
        <div>
          <dt>Colaboradores</dt>
          <dd>
            {collaboratorCount} / {unlockTarget}
          </dd>
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
