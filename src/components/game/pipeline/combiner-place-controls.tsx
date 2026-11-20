'use client'

import { useEffect, useState } from 'react'
import type { Direction } from './model/frame'
import {
  getCombinerPlaceOptions,
  setCombinerPlaceOptions,
  subscribeCombinerPlaceOptions,
} from './combiner-place-options'
import styles from '../game-shell.module.css'

const facings: { id: Direction; label: string }[] = [
  { id: 'east', label: 'Leste' },
  { id: 'south', label: 'Sul' },
  { id: 'west', label: 'Oeste' },
  { id: 'north', label: 'Norte' },
]

type Props = {
  structureId: string
}

const FACING_STRUCTURE_HEADINGS: Record<string, string> = {
  combiner_2: 'Combinador',
  combiner_3: 'Tri-combinador',
  trashcan: 'Lixeira',
  splitter: 'Divisor',
  tunnel: 'Túnel',
}

/** Facing picker for machines that expose a travel direction before placement. */
export function CombinerPlaceControls({ structureId }: Props) {
  const heading = FACING_STRUCTURE_HEADINGS[structureId]
  const [revision, setRevision] = useState(0)
  const options = getCombinerPlaceOptions()

  useEffect(() => {
    return subscribeCombinerPlaceOptions(() => setRevision((n) => n + 1))
  }, [])

  if (!heading) return null

  void revision

  return (
    <section className={styles.sidebarStats} aria-labelledby="machine-facing-heading">
      <h2 id="machine-facing-heading" className={styles.sidebarSectionTitle}>
        {heading}
      </h2>
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