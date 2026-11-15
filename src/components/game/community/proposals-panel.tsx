'use client'

import { statusLabels, formatGameDate as date } from '../model/presentation'
import { type TowerState, type User, type Proposal } from '../model/types'
import styles from '../tower-game.module.css'

export function ProposalsPanel({
  state,
  user,
  busy,
  onDecide,
}: {
  state: TowerState
  user: User | null
  busy: boolean
  onDecide: (proposal: Proposal, accept: boolean, reason: string) => void
}) {
  return (
    <>
      <details className={styles.eventLog}>
        <summary>Regras de decisão</summary>
        <ul className={styles.rules}>
          <li>
            Saldo: até {Number(state.rules.cap)} moedas; +1 a cada{' '}
            {Number(state.rules.intervalMs) / 1000}s.
          </li>
          <li>
            Suspensões são decididas pelo BDFL (criador da árvore).
          </li>
          <li>
            Suspensão local: {Number(state.rules.banDurationMs) / 60000} min.
          </li>
        </ul>
      </details>
      <div className={styles.proposals}>
        {state.proposals.length === 0 && <p>Nenhuma proposta.</p>}
        {[...state.proposals].reverse().map((proposal) => (
          <article key={proposal.id}>
            <div className={styles.panelTitle}>
              <h3>Suspender participante</h3>
              <span>{statusLabels[proposal.status] || proposal.status}</span>
            </div>
            <p>{proposal.reason}</p>
            {proposal.decisionReason && (
              <p>
                <strong>Justificativa da decisão:</strong> {proposal.decisionReason}
              </p>
            )}
            <small>
              Alvo:{' '}
              {state.members.find((person) => person.id === proposal.targetId)
                ?.nickname || 'Participante'}{' '}
              · {date(proposal.createdAt)}
            </small>
            {user?.id === state.tower.creatorId &&
              proposal.status === 'pending' && (
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault()
                    const data = new FormData(event.currentTarget)
                    onDecide(proposal, data.get('accept') === 'yes', String(data.get('reason')))
                  }}
                >
                  <label>
                    Motivo
                    <input name="reason" required minLength={3} maxLength={500} />
                  </label>
                  <button name="accept" value="yes" disabled={busy}>
                    Aceitar
                  </button>
                  <button name="accept" value="no" disabled={busy}>
                    Rejeitar
                  </button>
                </form>
              )}
          </article>
        ))}
      </div>
    </>
  )
}