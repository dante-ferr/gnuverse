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
      <details className={styles.eventLog}>
        <summary>Sobre as versões</summary>
        <p>
          São registradas após o repouso. Restaurar exige decisão e não apaga
          gastos ou contribuições.
        </p>
      </details>
      <div className={styles.snapshots}>
        {[...state.snapshots].reverse().map((snapshot, index) => (
          <article key={snapshot.id} className={styles.snapshot}>
            <button
              aria-label={`Visualizar versão ${state.snapshots.length - index}`}
              onClick={() => onPreview(snapshot)}
            >
              <svg viewBox="0 0 1000 800" aria-hidden="true">
                <rect width="1000" height="800" fill="var(--scene)" />
                <path d="M0 740h1000" stroke="var(--scene-line)" strokeWidth="8" />
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
              Propor restauração
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
