import type { PipelineFrame } from './model/frame'
import styles from '../game-shell.module.css'

const resourceGlyph: Record<PipelineFrame['source']['shape'], string> = {
  circle: '/pipeline/resource-circle.svg',
}

type Props = {
  frame: PipelineFrame | null
}

/** Live unlock / delivery readouts for the central core (HTML sidebar, not canvas). */
export function CoreRequirementsSidebar({ frame }: Props) {
  if (!frame?.seed) {
    return (
      <aside className={styles.gameSidebar} aria-label="Requisitos do núcleo">
        <p className={styles.controlsHint}>Abra ou crie uma sala para ver os requisitos do núcleo.</p>
      </aside>
    )
  }

  const collaborators =
    frame.collaborators.length === 1
      ? '1 colaborador'
      : `${frame.collaborators.length} colaboradores`

  return (
    <aside className={styles.gameSidebar} aria-label="Requisitos do núcleo">
      <div className={styles.collectiveHeading}>
        <p className={styles.eyebrow}>Open Pipeline</p>
        <h2>Requisitos do núcleo</h2>
      </div>
      <dl className={styles.coreRequirements}>
        <div>
          <dt>Versão</dt>
          <dd>v{frame.version}</dd>
        </div>
        <div>
          <dt>Colaboradores</dt>
          <dd>{collaborators}</dd>
        </div>
      </dl>
      <p className={styles.coreRequirementsLegend}>Formas exigidas</p>
      <ul className={styles.coreRequirementGrid}>
        {frame.demands.map((demand) => {
          const glyph = resourceGlyph[demand.shape]
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
              <span className={styles.coreRequirementCount}>
                {demand.received} / {demand.required}
              </span>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}