import { randomUUID } from 'node:crypto'
import type { Member, Proposal, Rules, Room, User } from '../domain/types.ts'
import { fail, text, mode } from '../domain/validation.ts'
import { SimulationCoordinator } from '../runtime/simulation-coordinator.ts'
import { HistoryService } from '../rooms/history-service.ts'

export class GovernanceService {
  private rules: Readonly<Rules>
  private now: () => number
  private runtime: SimulationCoordinator
  private history: HistoryService
  constructor(
    rules: Readonly<Rules>,
    now: () => number,
    runtime: SimulationCoordinator,
    history: HistoryService,
  ) {
    this.rules = rules
    this.now = now
    this.runtime = runtime
    this.history = history
  }
  private enact(room: Room, proposal: Proposal, actorId: string | null) {
    room.members[proposal.targetId].banned = true
    room.members[proposal.targetId].bannedUntil =
      this.now() + this.rules.banDurationMs
    this.history.event(room, 'ban', actorId, {
      targetId: proposal.targetId,
      proposalId: proposal.id,
      reason: proposal.decisionReason ?? proposal.reason,
    })
    proposal.executionStatus = 'executed'
    proposal.executedAt = this.now()
  }
  expireBans(room: Room) {
    for (const participant of Object.values(room.members))
      if (
        participant.banned &&
        participant.bannedUntil !== undefined &&
        participant.bannedUntil <= this.now()
      ) {
        participant.banned = false
        this.history.event(room, 'ban-expired', null, {
          targetId: participant.id,
        })
      }
  }
  propose(
    room: Room,
    user: User,
    participant: Member,
    body: Record<string, unknown>,
  ) {
    if (!participant.contributions && user.id !== room.creatorId)
      fail(403, 'Contribua antes de propor uma decisão.')
    if (room.proposals.some((p) => p.status === 'pending'))
      fail(409, 'Já existe uma proposta pendente.')
    const type = mode(body.type, ['ban'])
    const targetId = text(body.targetId, 1, 100, 'Alvo')
    if (
      !room.members[targetId] ||
      room.members[targetId].banned ||
      targetId === room.creatorId
    )
      fail(400, 'Alvo de banimento inválido.')
    const proposal: Proposal = {
      id: randomUUID(),
      type,
      targetId,
      reason: text(body.reason, 3, 500, 'Motivo'),
      actorId: user.id,
      status: 'pending',
      createdAt: this.now(),
    }
    room.proposals.push(proposal)
    this.history.event(room, 'proposal', user.id, {
      proposalId: proposal.id,
      type,
      targetId,
    })
    if (user.id === room.creatorId) {
      proposal.status = 'accepted'
      proposal.decidedAt = this.now()
      proposal.decidedBy = user.id
      this.enact(room, proposal, user.id)
    }
    return { proposal }
  }
  decide(
    room: Room,
    user: User,
    proposal: Proposal,
    body: Record<string, unknown>,
  ) {
    if (user.id !== room.creatorId)
      fail(403, 'Somente o BDFL decide esta proposta.')
    const accept = body.accept === true
    const reason = text(body.reason, 3, 500, 'Motivo')
    proposal.status = accept ? 'accepted' : 'rejected'
    proposal.decidedAt = this.now()
    proposal.decidedBy = user.id
    proposal.decisionReason = reason
    this.history.event(room, 'bdfl-decision', user.id, {
      proposalId: proposal.id,
      accept,
      reason,
    })
    if (accept) this.enact(room, proposal, user.id)
    return { ok: true }
  }
}