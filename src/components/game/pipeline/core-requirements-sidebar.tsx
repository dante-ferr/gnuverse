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
  const demandedShapes: PipelineFrame['source']['shape'][] = [frame.source.shape]

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
          <dt>Entregas</dt>
          <dd>{frame.deliveries}</dd>
        </div>
        <div>
          <dt>Colaboradores</dt>
          <dd>{collaborators}</dd>
        </div>
        <div>
          <dt>Formas exigidas</dt>
          <dd className={styles.coreRequirementShapes}>
            {demandedShapes.map((shape) => (
              <img
                key={shape}
                className={styles.coreRequirementShapeGlyph}
                src={resourceGlyph[shape]}
                alt=""
                width={28}
                height={28}
              />
            ))}
          </dd>
        </div>
      </dl>
    </aside>
  )
}