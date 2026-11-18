'use client'

import { useState } from 'react'
import type { GameApi } from '../api/game-api'
import type { Member, User } from '../model/types'
import type { PipelineFrame } from './model/frame'
import styles from '../game-shell.module.css'

type Props = {
  api: GameApi
  roomId: string
  user: User | null
  creatorId: string
  members: Member[]
  collaborators: PipelineFrame['collaborators']
  unlockCollaborators: number
  busy?: boolean
  onRefresh: () => Promise<void>
  onError: (message: string) => void
}

function letterAvatar(nickname: string) {
  const trimmed = nickname.trim()
  return (trimmed ? trimmed[0] : '?').toUpperCase()
}

/** Room members plus collaborator unlock progress (unified Participantes page). */
export function RoomParticipants({
  api,
  roomId,
  user,
  creatorId,
  members,
  collaborators,
  unlockCollaborators,
  busy,
  onRefresh,
  onError,
}: Props) {
  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState('')
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
  const people = [...peopleById.values()]

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

  return (
    <section className={styles.sidebarPageStack} aria-labelledby="room-participants-heading">
      <h2 id="room-participants-heading" className={styles.sidebarSectionTitle}>
        Participantes
      </h2>
      <dl className={styles.coreRequirements}>
        <div>
          <dt>Colaboradores</dt>
          <dd>
            {collaborators.length} / {unlockCollaborators}
          </dd>
        </div>
      </dl>
      {people.length === 0 ? (
        <p className={styles.controlsHint}>Ninguém na sala ainda.</p>
      ) : (
        <div className={styles.members}>
          {people.map((member) => (
            <article key={member.id}>
              <span className={styles.avatar} aria-hidden>
                {letterAvatar(member.nickname)}
              </span>
              <div>
                <strong>{member.nickname}</strong>
                <small>
                  {member.contributions} contribuições
                  {collaboratorIds.has(member.id) ? ' · colaborador' : ''}
                  {member.banned ? ' · suspenso' : ''}
                  {member.id === creatorId ? ' · BDFL' : ''}
                </small>
              </div>
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
        <p className={styles.quiet}>Entre para propor uma suspensão.</p>
      )}
    </section>
  )
}
