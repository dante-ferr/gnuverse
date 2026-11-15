'use client'

import { EventDetail } from './event-detail'
import { eventLabels, formatGameDate as date } from '../model/presentation'
import { type TowerState } from '../model/types'
import styles from '../tower-game.module.css'

export function HistoryPanel({ state }: { state: TowerState }) {
  return (
    <>
      <details className={styles.eventLog}>
        <summary>Sobre as versões</summary>
        <p>Instantâneos da árvore registrados em marcos da partida.</p>
      </details>
      <div className={styles.snapshots}>
        {[...state.snapshots].reverse().map((snapshot, index) => (
          <article key={snapshot.id} className={styles.snapshot}>
            <strong>Versão {state.snapshots.length - index}</strong>
            <small>
              {date(snapshot.createdAt)} · {snapshot.tree.nodes.length} nós
            </small>
            <p>{snapshot.reason}</p>
          </article>
        ))}
      </div>
      <details className={styles.eventLog}>
        <summary>Registro de ações ({state.events.length})</summary>
        <ol>
          {[...state.events].reverse().map((event) => (
            <li key={event.id}>
              {eventLabels[event.type] ?? event.type}: <EventDetail event={event} />
            </li>
          ))}
        </ol>
      </details>
    </>
  )
}