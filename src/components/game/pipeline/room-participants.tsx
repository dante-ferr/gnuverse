'use client'

import { useEffect, useState } from 'react'
import type { GameApi } from '../api/game-api'
import type { GameEvent, Member, User } from '../model/types'
import type { PipelineFrame } from './model/frame'
import { playerAchievements } from '../player-history/achievements'
import { PlayerHistoryOverlay } from '../player-history/player-history-overlay'
import styles from '../game-shell.module.css'

type Props = {
  api: GameApi
  roomId: string
  user: User | null
  creatorId: string
  members: Member[]
  collaborators: PipelineFrame['collaborators']
  spentByUserId?: Record<string, number>
  busy?: boolean
  onRefresh: () => Promise<void>
  onError: (message: string) => void
}

function letterAvatar(nickname: string) {
  const trimmed = nickname.trim()
  return (trimmed ? trimmed[0] : '?').toUpperCase()
}

/** Room members and moderation (Participantes page). */
export function RoomParticipants({
  api,
  roomId,
  user,
  creatorId,
  members,
  collaborators,
  spentByUserId,
  busy,
  onRefresh,
  onError,
}: Props) {
  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState('')
  const [historyMember, setHistoryMember] = useState<Member | null>(null)
  const [historyEvents, setHistoryEvents] = useState<GameEvent[]>([])
  const historyMemberId = historyMember?.id
  // The room payload no longer carries the event log; load one player's slice on open.
  useEffect(() => {
    setHistoryEvents([])
    if (!historyMemberId) return
    let active = true
    api
      .request<{ events?: GameEvent[] }>(
        `/api/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(historyMemberId)}/history`,
      )
      .then((result) => {
        if (active) setHistoryEvents(Array.isArray(result.events) ? result.events : [])
      })
      .catch((cause) => {
        if (active)
          onError(cause instanceof Error ? cause.message : 'Não foi possível carregar o histórico.')
      })
    return () => {
      active = false
    }
  }, [api, roomId, historyMemberId, onError])
  const collaboratorIds = new Set(collaborators.map((person) => person.id))
  const peopleById = new Map<string, Member>()
  for (const member of members) peopleById.set(member.id, member)
  for (const person of collaborators) {
    if (peopleById.has(person.id)) continue
    peopleById.set(person.id, {
      id: person.id,
      nickname: person.nickname,
      contributions: 0,
      eligible: true,
      banned: false,
    })
  }
  const spend = spentByUserId ?? {}
  const people = [...peopleById.values()].sort(
    (a, b) => (spend[b.id] ?? 0) - (spend[a.id] ?? 0),
  )

  const proposalTargets = people.filter(
    (member) => member.id !== user?.id && !member.banned && member.id !== creatorId,
  )

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
        await api.request(`/api/rooms/${roomId}/proposals`, {
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

  return (
    <section className={styles.sidebarPageStack} aria-labelledby="room-participants-heading">
      <h2 id="room-participants-heading" className={styles.sidebarSectionTitle}>
        Participantes
      </h2>
      <p className={styles.controlsHint}>
        Ranking por moedas investidas na sala (aportes e compras), não pela Pontuação do jogo.
      </p>
      {people.length === 0 ? (
        <p className={styles.controlsHint}>Ninguém na sala ainda.</p>
      ) : (
        <div className={styles.members}>
          {people.map((member) => (
            <article key={member.id}>
              <button
                type="button"
                className={styles.memberRowButton}
                onClick={() => setHistoryMember(member)}
                aria-label={`Ver histórico de ${member.nickname}`}
              >
                <span className={styles.avatar} aria-hidden>
                  {letterAvatar(member.nickname)}
                </span>
                <span className={styles.memberRowText}>
                  <strong>{member.nickname}</strong>
                  <small>
                    {new Intl.NumberFormat('pt-BR').format(spend[member.id] ?? 0)} moedas investidas
                    {' · '}
                    {member.contributions} contribuições
                    {collaboratorIds.has(member.id) ? ' · colaborador' : ''}
                    {member.banned ? ' · suspenso' : ''}
                    {member.id === creatorId ? ' · BDFL' : ''}
                  </small>
                </span>
              </button>
            </article>
          ))}
        </div>
      )}
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
        <p className={styles.controlsHint}>Entre para propor uma suspensão.</p>
      )}
      {historyMember ? (
        <PlayerHistoryOverlay
          nickname={historyMember.nickname}
          events={playerAchievements(historyEvents, historyMember.id)}
          onClose={() => setHistoryMember(null)}
        />
      ) : null}
    </section>
  )
}
