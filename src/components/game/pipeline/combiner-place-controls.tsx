'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CombinerMachineId } from '../../../../game-server/pipeline/machines/combiner-machine.ts'
import type { Direction, PipelineRules } from './model/frame'
import {
  getCombinerPlaceOptions,
  setCombinerPlaceOptions,
  subscribeCombinerPlaceOptions,
  syncCombinerRecipeForMachine,
} from './combiner-place-options'
import styles from '../game-shell.module.css'

const facings: { id: Direction; label: string }[] = [
  { id: 'east', label: 'Leste' },
  { id: 'south', label: 'Sul' },
  { id: 'west', label: 'Oeste' },
  { id: 'north', label: 'Norte' },
]

type Props = {
  rules: PipelineRules | null
  structureId: string
}

/** Recipe and facing pickers for sandbox combiner placement. */
export function CombinerPlaceControls({ rules, structureId }: Props) {
  const isCombiner = structureId === 'combiner_2' || structureId === 'combiner_3'
  const [revision, setRevision] = useState(0)
  const options = getCombinerPlaceOptions()

  const recipes = useMemo(() => {
    if (!rules?.elements || !isCombiner) return []
    return rules.elements.elements.filter(
      (el) => el.machine === structureId && el.inputs.length > 0 && !el.coproduct_of,
    )
  }, [rules, structureId, isCombiner])

  useEffect(() => {
    if (!isCombiner || recipes.length === 0) return
    syncCombinerRecipeForMachine(structureId as CombinerMachineId, recipes.map((el) => el.id))
  }, [isCombiner, structureId, recipes])

  useEffect(() => {
    return subscribeCombinerPlaceOptions(() => setRevision((n) => n + 1))
  }, [])

  if (!isCombiner || recipes.length === 0) return null

  void revision

  return (
    <section className={styles.sidebarStats} aria-labelledby="combiner-place-heading">
      <h2 id="combiner-place-heading" className={styles.sidebarSectionTitle}>
        Combinador
      </h2>
      <label>
        Receita
        <select
          value={options.recipeId}
          onChange={(event) => {
            setCombinerPlaceOptions({ recipeId: event.target.value })
            setRevision((n) => n + 1)
          }}
        >
          {recipes.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.name_pt}
            </option>
          ))}
        </select>
      </label>
      <label>
        Orientação
        <select
          value={options.facing}
          onChange={(event) => {
            setCombinerPlaceOptions({ facing: event.target.value as Direction })
            setRevision((n) => n + 1)
          }}
        >
          {facings.map((facing) => (
            <option key={facing.id} value={facing.id}>
              {facing.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}
