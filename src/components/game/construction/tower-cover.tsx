'use client'

import type { Tower } from '../model/types'
import styles from '../tower-game.module.css'

export function TowerCover({ tower }: { tower: Tower }) {
  const nodes = tower.coverNodes ?? []
  return (
    <svg viewBox="0 0 800 1200" className={styles.cover} aria-hidden="true">
      <rect width="800" height="1200" fill="var(--scene)" />
      <rect x="320" y="0" width="160" height="80" fill="none" stroke="var(--scene-line)" />
      {nodes.map((node) => (
        <circle key={node.id} cx={node.x} cy={node.y} r={6} fill="var(--scene-accent, #57c79e)" />
      ))}
    </svg>
  )
}