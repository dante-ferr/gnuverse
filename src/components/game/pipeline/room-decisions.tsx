'use client'

import { useState } from 'react'
import type { GameApi } from '../api/game-api'
import { formatGameDate, statusLabels } from '../model/presentation'
import type { Member, Proposal, User } from '../model/types'
import styles from '../game-shell.module.css'

type Props = {
  api: GameApi
  roomId: string
  user: User | null
  creatorId: string
  members: Member[]
  proposals: Proposal[]
  busy?: boolean
  canAdvance?: boolean
  onAdvance?: () => void
  onRefresh: () => Promise<void>
  onError: (message: string) => void
}

/** Ban proposals and BDFL decisions for the Decisões sidebar page. */
export function RoomDecisions({
  api,
  roomId,
  user,
  creatorId,
  members,
  proposals,
  busy,
  canAdvance,
  onAdvance,
  onRefresh,
  onError,
}: Props) {
  const [decideReason, setDecideReason] = useState<Record<string, string>>({})
  const isBdfl = Boolean(user && user.id === creatorId)
  const memberById = new Map(members.map((member) => [member.id, member]))

  const decide = (proposalId: string, accept: boolean) => {
    const bodyReason = decideReason[proposalId] ?? ''
    void (async () => {
      try {
        await api.request(`/api/towers/${roomId}/proposals/${proposalId}/decide`, {
          accept,
          reason: bodyReason,
        })
        await onRefresh()
      } catch (cause) {
        onError(cause instanceof Error ? cause.message : 'Não foi possível registrar a decisão.')
      }
    })()
  }

  return (
    <section className={styles.sidebarPageStack} aria-labelledby="room-decisions-heading">
      <h2 id="room-decisions-heading" className={styles.sidebarSectionTitle}>
        Decisões
      </h2>
      {canAdvance && onAdvance ? (
        <div className={styles.form}>
          <p className={styles.quiet}>
            A versão sobe sozinha quando as demandas são cumpridas. Administradores podem forçar o
            próximo marco.
          </p>
          <button type="button" className={styles.secondary} disabled={busy} onClick={onAdvance}>
            Avançar versão
          </button>
        </div>
      ) : null}
      <div className={styles.proposals}>
        {proposals.length === 0 ? (
          <p className={styles.quiet}>Nenhuma proposta ainda.</p>
        ) : (
          proposals.map((proposal) => {
            const target = memberById.get(proposal.targetId)
            return (
              <article key={proposal.id}>
                <h3>Suspensão · {statusLabels[proposal.status] ?? proposal.status}</h3>
                <p>
                  Alvo: <strong>{target?.nickname ?? proposal.targetId}</strong>
                </p>
                <p>{proposal.reason}</p>
                <small>Criada em {formatGameDate(proposal.createdAt)}</small>
                {proposal.status === 'pending' && isBdfl ? (
                  <div className={styles.form}>
                    <label>
                      Motivo da decisão
                      <input
                        value={decideReason[proposal.id] ?? ''}
                        onChange={(event) =>
                          setDecideReason((current) => ({
                            ...current,
                            [proposal.id]: event.target.value,
                          }))
                        }
                        minLength={3}
                        maxLength={500}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.primary}
                      disabled={busy}
                      onClick={() => decide(proposal.id, true)}
                    >
                      Aceitar
                    </button>
                    <button
                      type="button"
                      className={styles.quiet}
                      disabled={busy}
                      onClick={() => decide(proposal.id, false)}
                    >
                      Rejeitar
                    </button>
                  </div>
                ) : null}
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
