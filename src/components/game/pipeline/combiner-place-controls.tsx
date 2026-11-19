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

/** Facing picker for sandbox combiner placement. */
export function CombinerPlaceControls({ structureId }: Props) {
  const isCombiner = structureId === 'combiner_2' || structureId === 'combiner_3'
  const [revision, setRevision] = useState(0)
  const options = getCombinerPlaceOptions()

  useEffect(() => {
    return subscribeCombinerPlaceOptions(() => setRevision((n) => n + 1))
  }, [])

  if (!isCombiner) return null

  void revision

  return (
    <section className={styles.sidebarStats} aria-labelledby="combiner-place-heading">
      <h2 id="combiner-place-heading" className={styles.sidebarSectionTitle}>
        Combinador
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