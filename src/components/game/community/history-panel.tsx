'use client'

import { Blocks } from '../construction/block-shapes'
import { EventDetail } from './event-detail'
import { eventLabels, formatGameDate as date } from '../model/presentation'
import { type TowerState, type User, type Snapshot } from '../model/types'
import styles from '../tower-game.module.css'

export function HistoryPanel({
  state,
  user,
  busy,
  onPreview,
  onPropose,
}: {
  state: TowerState
  user: User | null
  busy: boolean
  onPreview: (version: Snapshot) => void
  onPropose: (version: Snapshot) => void
}) {
  return (
    <>
      <p className={styles.hint}>
        As versões são registradas após o repouso. Consultar não altera a torre;
        restaurar exige uma decisão e preserva gastos e contribuições.
      </p>
      <div className={styles.snapshots}>
        {[...state.snapshots].reverse().map((snapshot, index) => (
          <article key={snapshot.id} className={styles.snapshot}>
            <button
              aria-label={`Visualizar versão ${state.snapshots.length - index}`}
              onClick={() => onPreview(snapshot)}
            >
              <svg viewBox="0 0 1000 800" aria-hidden="true">
                <rect width="1000" height="800" fill="#eeece5" />
                <path d="M0 740h1000" stroke="#b8b0a4" strokeWidth="8" />
                <Blocks blocks={snapshot.blocks} />
              </svg>
            </button>
            <strong>Versão {state.snapshots.length - index}</strong>
            <small>
              {date(snapshot.createdAt)} · {snapshot.blocks.length} blocos
            </small>
            <button
              className={styles.quiet}
              disabled={!user || busy}
              onClick={() => onPropose(snapshot)}
            >
              Propor restauração ↗
            </button>
          </article>
        ))}
      </div>
      <details className={styles.eventLog}>
        <summary>Registro de ações ({state.events.length})</summary>
        <ol>
          {[...state.events].reverse().map((event) => (
            <li key={event.id}>
              <time>{date(event.createdAt)}</time>
              <strong>{eventLabels[event.type] || 'Ação registrada'}</strong>
              <span>
                {state.members.find((person) => person.id === event.actorId)
                  ?.nickname || 'Sistema'}
              </span>
              <EventDetail event={event} />
            </li>
          ))}
        </ol>
      </details>
    </>
  )
}
