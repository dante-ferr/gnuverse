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
  onRefresh: () => Promise<void>
  onError: (message: string) => void
}

/** Minimal sala governance: suspend proposals and BDFL decisions. */
export function PipelineModerationPanel({
  api,
  roomId,
  user,
  creatorId,
  members,
  proposals,
  busy,
  onRefresh,
  onError,
}: Props) {
  const [tab, setTab] = useState<'members' | 'proposals'>('members')
  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState('')
  const [decideReason, setDecideReason] = useState<Record<string, string>>({})
  const isBdfl = Boolean(user && user.id === creatorId)

  const memberById = new Map(members.map((member) => [member.id, member]))

  const proposeBan = () => {
    if (!user) {
      onError('Entre para propor uma suspensão.')
      return
    }
    if (!targetId) {
      onError('Escolha um participante.')
      return
    }
    void (async () => {
      try {
        await api.request(`/api/towers/${roomId}/proposals`, {
          type: 'ban',
          targetId,
          reason,
        })
        setReason('')
        setTargetId('')
        await onRefresh()
      } catch (cause) {
        onError(cause instanceof Error ? cause.message : 'Não foi possível enviar a proposta.')
      }
    })()
  }

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

  const proposalTargets = members.filter(
    (member) => member.id !== user?.id && !member.banned && member.id !== creatorId,
  )

  return (
    <section className={styles.sidebarModeration} aria-label="Moderação da sala">
      <div className={styles.tabs} role="tablist" aria-label="Painéis da sala">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'members'}
          onClick={() => setTab('members')}
        >
          Participantes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'proposals'}
          onClick={() => setTab('proposals')}
        >
          Decisões
        </button>
      </div>
      {tab === 'members' ? (
        <>
          <div className={styles.members}>
            {members.map((member) => (
              <article key={member.id}>
                <span className={styles.avatar} aria-hidden>
                  {member.nickname.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{member.nickname}</strong>
                  <small>
                    {member.contributions} contribuições
                    {member.banned ? ' · suspenso' : ''}
                    {member.id === creatorId ? ' · BDFL' : ''}
                  </small>
                </div>
              </article>
            ))}
          </div>
          {user ? (
            <div className={styles.form}>
              <label>
                Propor suspensão
                <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                  <option value="">Participante</option>
                  {proposalTargets.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.nickname}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Motivo
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={3}
                  maxLength={500}
                  placeholder="Descreva o motivo"
                />
              </label>
              <button type="button" className={styles.primary} disabled={busy} onClick={proposeBan}>
                Propor suspensão
              </button>
            </div>
          ) : (
            <p className={styles.quiet}>Entre para propor uma suspensão.</p>
          )}
        </>
      ) : (
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
      )}
    </section>
  )
}