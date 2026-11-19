'use client'

import { CenteredOverlay } from '../../overlay/centered-overlay'
import type { GameEvent } from '../model/types'
import {
  formatAchievementLabel,
  formatAchievementTime,
  isAchievementEvent,
} from './achievements'
import styles from './player-history-overlay.module.css'

export type PlayerHistoryOverlayProps = {
  nickname: string
  events: readonly GameEvent[]
  onClose: () => void
}

/** Centered overlay listing a player's achievement history. */
export function PlayerHistoryOverlay({
  nickname,
  events,
  onClose,
}: PlayerHistoryOverlayProps) {
  const achievements = events
    .filter(isAchievementEvent)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)

  return (
    <CenteredOverlay title={`Histórico de ${nickname}`} onClose={onClose}>
      {achievements.length === 0 ? (
        <p className={styles.empty}>Nenhuma conquista registrada ainda.</p>
      ) : (
        <ol className={styles.list}>
          {achievements.map((event) => (
            <li key={event.id} className={styles.item}>
              <span className={styles.label}>{formatAchievementLabel(event)}</span>
              <time className={styles.time} dateTime={new Date(event.createdAt).toISOString()}>
                {formatAchievementTime(event.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </CenteredOverlay>
  )
}
