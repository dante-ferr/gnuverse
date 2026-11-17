'use client'

import type { Room } from '../model/types'
import styles from '../game-shell.module.css'

/** Placeholder cover until pipeline previews ship. */
export function RoomCover({ room: _room }: { room: Room }) {
  return (
    <svg className={styles.roomCover} viewBox="0 0 320 194" aria-hidden="true">
      <rect width="320" height="194" fill="var(--scene)" />
      <circle cx="48" cy="96" r="18" fill="var(--accent)" opacity="0.85" />
      <rect x="120" y="88" width="160" height="12" rx="2" fill="var(--line)" />
      <rect x="248" y="72" width="48" height="48" rx="4" fill="var(--accent-soft)" stroke="var(--accent)" />
    </svg>
  )
}