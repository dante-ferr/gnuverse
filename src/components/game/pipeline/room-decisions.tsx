'use client'

import { useState } from 'react'
import type { GameApi } from '../api/game-api'
import { formatGameDate, statusLabels } from '../model/presentation'
import type { Checkpoint, Member, Proposal, RoomGovernance, User } from '../model/types'
import type { PipelineRules } from './model/frame'
import { CheckpointTimelineOverlay, checkpointKindLabels } from './checkpoint-timeline-overlay'
import styles from './room-decisions.module.css'

type Props = {
  api: GameApi
  roomId: string
  user: User | null
  creatorId: string
  members: Member[]
  proposals: Proposal[]
  checkpoints: Checkpoint[]
  governance: RoomGovernance
  rules: PipelineRules | null
  busy?: boolean
  canAdvance?: boolean
  onAdvance?: () => void
  onRefresh: () => Promise<void>
  onError: (message: string) => void
}

const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value)
const deciderLabel = (byMajority: boolean) => (byMajority ? 'Maioria' : 'BDFL')

/** Checkpoints, decision rules, and proposals for the Decisões sidebar page. */
export function RoomDecisions({
  api,
  roomId,
  user,
  creatorId,
  members,
  proposals,
  checkpoints,
  governance,
  rules,
  busy,
  canAdvance,
  onAdvance,
  onRefresh,
  onError,
}: Props) {
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [decideReason, setDecideReason] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState<{ restoreByMajority: boolean; banByMajority: boolean } | null>(null)
  const [settingsReason, setSettingsReason] = useState('')
  const isBdfl = Boolean(user && user.id === creatorId)
  const memberById = new Map(members.map((member) => [member.id, member]))
  const checkpointById = new Map(checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]))
  const me = user ? memberById.get(user.id) : undefined
  const isContributor = Boolean(me && me.contributions > 0 && !me.banned)
  const pendingRestore = proposals.find(
    (proposal) => proposal.type === 'restore' && proposal.status === 'pending',
  )
  const pending = proposals.filter((proposal) => proposal.status === 'pending').reverse()
  const closed = proposals.filter((proposal) => proposal.status !== 'pending').reverse()
  const rulesDraft = draft ?? {
    restoreByMajority: governance.restoreByMajority,
    banByMajority: governance.banByMajority,
  }
  const settingsChanged =
    rulesDraft.restoreByMajority !== governance.restoreByMajority ||
    rulesDraft.banByMajority !== governance.banByMajority
  const threshold = rules?.checkpointSpendCoins ?? 0
  const spent = Math.min(governance.checkpointSpend, threshold)

  const send = async (path: string, body: Record<string, unknown>, fallback: string) => {
    try {
      await api.request(`/api/rooms/${roomId}${path}`, body)
      await onRefresh()
      return true
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : fallback)
      return false
    }
  }

  const proposeRestore = (snapshotId: string, reason: string) =>
    send(
      '/proposals',
      { type: 'restore', snapshotId, reason },
      'Não foi possível enviar a proposta.',
    )

  const decide = (proposalId: string, accept: boolean) =>
    void send(
      `/proposals/${proposalId}/decide`,
      { accept, reason: decideReason[proposalId] ?? '' },
      'Não foi possível registrar a decisão.',
    )

  const support = (proposalId: string) =>
    void send(`/proposals/${proposalId}/support`, {}, 'Não foi possível registrar sua concordância.')

  const saveSettings = async () => {
    const ok = await send(
      '/settings',
      { ...rulesDraft, reason: settingsReason },
      'Não foi possível salvar as regras.',
    )
    if (ok) {
      setDraft(null)
      setSettingsReason('')
    }
  }

  const proposalTarget = (proposal: Proposal) => {
    if (proposal.type === 'ban')
      return memberById.get(proposal.targetId)?.nickname ?? 'Participante'
    const checkpoint = checkpointById.get(proposal.targetId)
    return checkpoint
      ? `${checkpointKindLabels[checkpoint.kind]} · ${formatGameDate(checkpoint.createdAt)}`
      : 'Checkpoint removido'
  }

  const renderProposal = (proposal: Proposal) => {
    const open = proposal.status === 'pending'
    const tally = proposal.tally
    const agreed = Boolean(user && proposal.supporters?.includes(user.id))
    const canSupport =
      open &&
      isContributor &&
      !agreed &&
      !(proposal.type === 'ban' && proposal.targetId === user?.id)
    const proposer = memberById.get(proposal.actorId)?.nickname ?? 'Participante'
    const goal = tally ? (proposal.byMajority ? tally.needed : tally.voters) : 0
    return (
      <article key={proposal.id} className={styles.card}>
        <header className={styles.cardHead}>
          <strong>{proposal.type === 'restore' ? 'Restaurar' : 'Suspender'}</strong>
          <span className={styles.status} data-status={proposal.status}>
            {statusLabels[proposal.status] ?? proposal.status}
            {proposal.decidedByMajority ? ' · maioria' : ''}
          </span>
        </header>
        <p className={styles.target}>{proposalTarget(proposal)}</p>
        <p className={styles.reason}>{proposal.reason}</p>
        {tally ? (
          <div className={styles.tally}>
            <div
              className={styles.meter}
              role="meter"
              aria-label="Concordâncias"
              aria-valuemin={0}
              aria-valuemax={Math.max(goal, 1)}
              aria-valuenow={tally.supporters}
            >
              <span style={{ width: `${goal ? Math.min(100, (tally.supporters / goal) * 100) : 0}%` }} />
            </div>
            <span>
              {tally.supporters}/{goal}
            </span>
          </div>
        ) : null}
        <p className={styles.meta}>
          {proposer} · {formatGameDate(proposal.createdAt)}
          {proposal.decisionReason ? ` · ${proposal.decisionReason}` : ''}
        </p>
        {canSupport || agreed ? (
          <button
            type="button"
            className={styles.button}
            disabled={busy || agreed}
            onClick={() => support(proposal.id)}
          >
            {agreed ? 'Você concorda' : 'Concordo'}
          </button>
        ) : null}
        {open && isBdfl ? (
          <div className={styles.decide}>
            <input
              aria-label="Motivo da decisão"
              placeholder="Motivo da decisão"
              value={decideReason[proposal.id] ?? ''}
              onChange={(event) =>
                setDecideReason((current) => ({ ...current, [proposal.id]: event.target.value }))
              }
              minLength={3}
              maxLength={500}
            />
            <div className={styles.row}>
              {proposal.byMajority ? null : (
                <button
                  type="button"
                  className={styles.primary}
                  disabled={busy || (decideReason[proposal.id] ?? '').trim().length < 3}
                  onClick={() => decide(proposal.id, true)}
                >
                  Aceitar
                </button>
              )}
              <button
                type="button"
                className={styles.button}
                disabled={busy || (decideReason[proposal.id] ?? '').trim().length < 3}
                onClick={() => decide(proposal.id, false)}
              >
                Rejeitar
              </button>
            </div>
          </div>
        ) : null}
      </article>
    )
  }

  return (
    <section className={styles.page} aria-labelledby="room-decisions-heading">
      <h2 id="room-decisions-heading" className={styles.title}>
        Decisões
      </h2>

      <div className={styles.block}>
        <h3 className={styles.heading}>Checkpoints</h3>
        {threshold > 0 ? (
          <div className={styles.tally}>
            <div
              className={styles.meter}
              role="meter"
              aria-label="Moedas até o próximo checkpoint"
              aria-valuemin={0}
              aria-valuemax={threshold}
              aria-valuenow={spent}
            >
              <span style={{ width: `${(spent / threshold) * 100}%` }} />
            </div>
            <span>
              {formatNumber(spent)}/{formatNumber(threshold)}
            </span>
          </div>
        ) : null}
        <button type="button" className={styles.button} onClick={() => setTimelineOpen(true)}>
          Linha do tempo ({checkpoints.length})
        </button>
      </div>

      <div className={styles.block}>
        <h3 className={styles.heading}>Quem decide</h3>
        <dl className={styles.rules}>
          <div>
            <dt>Restauração</dt>
            <dd>
              {isBdfl ? (
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={rulesDraft.restoreByMajority}
                    onChange={(event) =>
                      setDraft({ ...rulesDraft, restoreByMajority: event.target.checked })
                    }
                  />
                  Maioria
                </label>
              ) : (
                deciderLabel(governance.restoreByMajority)
              )}
            </dd>
          </div>
          <div>
            <dt>Suspensão</dt>
            <dd>
              {isBdfl ? (
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={rulesDraft.banByMajority}
                    onChange={(event) =>
                      setDraft({ ...rulesDraft, banByMajority: event.target.checked })
                    }
                  />
                  Maioria
                </label>
              ) : (
                deciderLabel(governance.banByMajority)
              )}
            </dd>
          </div>
        </dl>
        {isBdfl && settingsChanged ? (
          <div className={styles.decide}>
            <input
              aria-label="Justificativa"
              placeholder="Justificativa"
              value={settingsReason}
              onChange={(event) => setSettingsReason(event.target.value)}
              minLength={3}
              maxLength={500}
            />
            <div className={styles.row}>
              <button
                type="button"
                className={styles.primary}
                disabled={busy || settingsReason.trim().length < 3}
                onClick={() => void saveSettings()}
              >
                Salvar
              </button>
              <button type="button" className={styles.button} onClick={() => setDraft(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.block}>
        <h3 className={styles.heading}>Propostas</h3>
        {pending.length === 0 ? <p className={styles.meta}>Nenhuma em aberto.</p> : pending.map(renderProposal)}
        {closed.length > 0 ? (
          <details className={styles.closed}>
            <summary>Encerradas ({closed.length})</summary>
            {closed.map(renderProposal)}
          </details>
        ) : null}
      </div>

      {canAdvance && onAdvance ? (
        <div className={styles.block}>
          <h3 className={styles.heading}>Administração</h3>
          <button type="button" className={styles.button} disabled={busy} onClick={onAdvance}>
            Avançar versão
          </button>
        </div>
      ) : null}

      {timelineOpen ? (
        <CheckpointTimelineOverlay
          api={api}
          roomId={roomId}
          rules={rules}
          checkpoints={checkpoints}
          pendingTargetId={pendingRestore?.targetId ?? null}
          canPropose={Boolean(user && (isBdfl || isContributor) && !pendingRestore)}
          proposeLabel={isBdfl && !governance.restoreByMajority ? 'Restaurar' : 'Propor restauração'}
          busy={busy}
          onPropose={proposeRestore}
          onClose={() => setTimelineOpen(false)}
        />
      ) : null}
    </section>
  )
}
