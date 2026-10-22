'use client'

import { statusLabels, formatGameDate as date } from '../model/presentation'
import {
  type TowerState,
  type User,
  type Snapshot,
  type Proposal,
} from '../model/types'
import styles from '../tower-game.module.css'

export function ProposalsPanel({
  state,
  user,
  busy,
  onPreview,
  onVote,
  onDecide,
}: {
  state: TowerState
  user: User | null
  busy: boolean
  onPreview: (snapshot: Snapshot | null) => void
  onVote: (proposal: Proposal, choice: string) => void
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
            Intervalo entre ações: {Number(state.rules.cooldownMs) / 1000}s.
          </li>
          <li>
            Uma pessoa, um voto; eleitorado fixado ao abrir a proposta. Prazo:{' '}
            {Number(state.rules.proposalDurationMs) / 1000}s; quórum:{' '}
            {Number(state.rules.quorum) * 100}%; aprovação acima de{' '}
            {Number(state.rules.approval) * 100}%. Abstenções contam para o
            quórum; empate rejeita.
          </li>
          <li>
            Troca de voto: {state.rules.voteChanges ? 'sim' : 'não'}. Sem veto do
            BDFL.
          </li>
          <li>
            Suspensão local: {Number(state.rules.banDurationMs) / 60000} min;
            sem construir, propor ou votar durante o prazo.
          </li>
        </ul>
      </details>
      <div className={styles.proposals}>
        {state.proposals.length === 0 && (
          <p>Nenhuma proposta.</p>
        )}
        {[...state.proposals].reverse().map((proposal) => (
          <article key={proposal.id}>
            <div className={styles.panelTitle}>
              <h3>
                {proposal.type === 'restore'
                  ? 'Restaurar versão'
                  : 'Suspender participante'}
              </h3>
              <span>{statusLabels[proposal.status] || proposal.status}</span>
            </div>
            {proposal.executionStatus === 'deferred' && (
              <small>Aguarda fim da ventania</small>
            )}
            <p>{proposal.reason}</p>
            {proposal.decisionReason && (
              <p>
                <strong>Justificativa da decisão:</strong>{' '}
                {proposal.decisionReason}
              </p>
            )}
            <small>
              Por{' '}
              {state.members.find((person) => person.id === proposal.actorId)
                ?.nickname || 'Participante'}
              {proposal.decidedBy
                ? ` · Decisão por ${state.members.find((person) => person.id === proposal.decidedBy)?.nickname || 'BDFL'}`
                : ''}
            </small>
            <small>
              Alvo:{' '}
              {proposal.type === 'restore'
                ? `Versão ${state.snapshots.findIndex((snapshot) => snapshot.id === proposal.targetId) + 1}`
                : state.members.find(
                    (person) => person.id === proposal.targetId,
                  )?.nickname || 'Participante'}{' '}
              · {date(proposal.createdAt)}
            </small>
            {proposal.type === 'restore' && (
              <button
                className={styles.quiet}
                onClick={() =>
                  onPreview(
                    state.snapshots.find(
                      (item) => item.id === proposal.targetId,
                    ) || null,
                  )
                }
              >
                Ver versão
              </button>
            )}
            {proposal.mode === 'vote' && (
              <>
                <p className={styles.tally}>
                  {
                    Object.values(proposal.votes).filter(
                      (choice) => choice === 'for',
                    ).length
                  }{' '}
                  a favor ·{' '}
                  {
                    Object.values(proposal.votes).filter(
                      (choice) => choice === 'against',
                    ).length
                  }{' '}
                  contra ·{' '}
                  {
                    Object.values(proposal.votes).filter(
                      (choice) => choice === 'abstain',
                    ).length
                  }{' '}
                  abstenções
                </p>
                <details className={styles.eventLog}>
                  <summary>
                    Regras e eleitorado · {proposal.electorate.length} pessoas
                  </summary>
                  <p>
                    Eleitorado fixado na abertura. Quórum:{' '}
                    {proposal.rules.quorum * 100}%; aprovação acima de{' '}
                    {proposal.rules.approval * 100}%;{' '}
                    {proposal.rules.voteChanges
                      ? 'voto pode ser alterado'
                      : 'voto definitivo'}
                    . Prazo:{' '}
                    {proposal.closesAt
                      ? date(proposal.closesAt)
                      : 'decisão do BDFL'}
                    .
                  </p>
                  <ul className={styles.rules}>
                    {proposal.electorate.map((id) => (
                      <li key={id}>
                        {state.members.find((person) => person.id === id)
                          ?.nickname || 'Participante'}
                        :{' '}
                        {(
                          {
                            for: 'a favor',
                            against: 'contra',
                            abstain: 'abstenção',
                          } as Record<string, string>
                        )[proposal.votes[id]] || 'ainda não votou'}
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            )}
            {proposal.mode === 'bdfl' && (
              <small>
                Decisão do BDFL com justificativa pública.
              </small>
            )}
            {['active', 'open', 'pending'].includes(proposal.status) && (
              <>
                {user &&
                  proposal.electorate.includes(user.id) &&
                  proposal.mode === 'vote' && (
                    <div className={styles.voteButtons}>
                      {[
                        ['for', 'A favor'],
                        ['against', 'Contra'],
                        ['abstain', 'Abster-se'],
                      ].map(([choice, label]) => (
                        <button
                          key={choice}
                          className={styles.secondary}
                          aria-pressed={proposal.votes[user.id] === choice}
                          disabled={
                            busy ||
                            Boolean(
                              proposal.votes[user.id] &&
                              !proposal.rules.voteChanges,
                            )
                          }
                          onClick={() => onVote(proposal, choice)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                {user?.id === state.tower.creatorId &&
                  proposal.mode === 'bdfl' && (
                    <form
                      className={styles.form}
                      onSubmit={(event) => {
                        event.preventDefault()
                        const data = new FormData(event.currentTarget)
                        void onDecide(
                          proposal,
                          data.get('decision') === 'accept',
                          String(data.get('justification')),
                        )
                      }}
                    >
                      <label>
                        Justificativa pública
                        <input
                          name="justification"
                          required
                          minLength={3}
                          maxLength={500}
                        />
                      </label>
                      <select aria-label="Decisão do BDFL" name="decision">
                        <option value="accept">Aceitar sugestão</option>
                        <option value="reject">Rejeitar sugestão</option>
                      </select>
                      <button className={styles.primary} disabled={busy}>
                        Registrar decisão
                      </button>
                    </form>
                  )}
              </>
            )}
          </article>
        ))}
      </div>
    </>
  )
}
