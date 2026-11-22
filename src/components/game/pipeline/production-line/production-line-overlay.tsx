'use client'

import { useMemo } from 'react'
import type { ElementCatalogJson } from '../../../../../game-server/pipeline/elements/index.ts'
import { CenteredOverlay } from '../../../overlay/centered-overlay'
import { buildAncestryChart } from './ancestry-layout'
import { ProductionLineGraph } from './production-line-graph'
import styles from './production-line-overlay.module.css'

type Props = {
  shape: string
  catalog: ElementCatalogJson | null | undefined
  onClose: () => void
}

/** Overlay with the production-line graph for one core requirement. */
export function ProductionLineOverlay({ shape, catalog, onClose }: Props) {
  const element = catalog?.elements.find((el) => el.id === shape) ?? null
  const chart = useMemo(
    () => (catalog && element ? buildAncestryChart(shape, catalog) : null),
    [catalog, element, shape],
  )

  const title = element?.name_pt ?? labelForLegacyShape(shape)

  return (
    <CenteredOverlay title={title} onClose={onClose}>
      {chart ? (
        <>
          <p className={styles.caption}>
            Linha de produção desde as bases até <strong>{element!.name_pt}</strong>.
          </p>
          <div className={styles.scroll}>
            <ProductionLineGraph chart={chart} />
          </div>
        </>
      ) : (
        <p className={styles.fallback}>
          {shape === 'circle'
            ? 'O círculo sai da fonte. Nesta versão não há receita de craft — leve-o até o núcleo com esteiras.'
            : 'Não há receita de craft cadastrada para este requisito.'}
        </p>
      )}
    </CenteredOverlay>
  )
}

function labelForLegacyShape(shape: string): string {
  if (shape === 'circle') return 'Círculo'
  return shape
}
