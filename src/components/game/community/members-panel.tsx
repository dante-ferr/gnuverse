'use client'

import { type TowerState, type User } from '../model/types'
import styles from '../tower-game.module.css'

export function MembersPanel({
  state,
  user,
  busy,
  isBanned,
  onEligibility,
  onBan,
}: {
  state: TowerState
  user: User | null
  busy: boolean
  isBanned: boolean
  onEligibility: (id: string, eligible: boolean) => void
  onBan: (id: string) => void
}) {
  return (
    <div className={styles.members}>
      {state.members.length === 0 && (
        <p>Sem participantes.</p>
      )}
      {state.members.map((person) => (
        <article key={person.id}>
          <div className={styles.avatar}>
            {person.nickname.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>
              {person.nickname}
              {person.id === state.tower.creatorId ? ' · BDFL' : ''}
            </strong>
            <small>
              {person.contributions} contribuições ·{' '}
              {person.banned
                ? 'suspenso nesta torre'
                : person.eligible
                  ? 'habilitado para votar'
                  : 'contribuidor'}
            </small>
          </div>
          {user?.id === state.tower.creatorId &&
            state.tower.eligibilityMode === 'manual' && (
              <button
                className={styles.quiet}
                disabled={busy || Boolean(isBanned)}
                onClick={() => onEligibility(person.id, !person.eligible)}
              >
                {person.eligible ? 'Desabilitar voto' : 'Habilitar voto'}
              </button>
            )}
          {user &&
            person.id !== user.id &&
            (person.id !== state.tower.creatorId ||
              (state.tower.allowCreatorBan &&
                state.tower.banMode === 'vote')) &&
            !person.banned && (
              <button className={styles.quiet} onClick={() => onBan(person.id)}>
                Propor suspensão
              </button>
            )}
        </article>
      ))}
    </div>
  )
}
