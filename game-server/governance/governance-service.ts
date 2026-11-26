import { randomUUID } from 'node:crypto'
import type { Member, Proposal, Rules, Room, User } from '../domain/types.ts'
import { fail, text, mode } from '../domain/validation.ts'
import { SimulationCoordinator } from '../runtime/simulation-coordinator.ts'
import { HistoryService } from '../rooms/history-service.ts'
import { CheckpointService } from '../rooms/checkpoint-service.ts'

/**
 * Ban and checkpoint-restore proposals.
 *
 * Contributors (members with at least one contribution, not suspended) agree
 * with a proposal. By default the room owner sees the count and accepts or
 * rejects. With `restoreByMajority` / `banByMajority` on, a proposal passes as
 * soon as more than half of the contributors agree; the owner can still reject
 * it to close it.
 */
export class GovernanceService {
  private rules: Readonly<Rules>
  private now: () => number
  private runtime: SimulationCoordinator
  private history: HistoryService
  private checkpoints: CheckpointService
  constructor(
    rules: Readonly<Rules>,
    now: () => number,
    runtime: SimulationCoordinator,
    history: HistoryService,
    checkpoints = new CheckpointService(rules, history),
  ) {
    this.rules = rules
    this.now = now
    this.runtime = runtime
    this.history = history
    this.checkpoints = checkpoints
  }
  private enact(room: Room, proposal: Proposal, actorId: string | null) {
    if (proposal.type === 'restore') {
      const snapshot = this.checkpoints.find(room, proposal.targetId)
      this.checkpoints.restore(room, snapshot, actorId, proposal.id)
      this.runtime.afterAction(room)
    } else {
      const target = room.members[proposal.targetId]
      if (!target || target.banned || proposal.targetId === room.creatorId)
        fail(409, 'Alvo de banimento inválido.')
      target.banned = true
      target.bannedUntil = this.now() + this.rules.banDurationMs
      this.history.event(room, 'ban', actorId, {
        targetId: proposal.targetId,
        proposalId: proposal.id,
        reason: proposal.decisionReason ?? proposal.reason,
      })
    }
    proposal.executionStatus = 'executed'
    proposal.executedAt = this.now()
  }
  /** True when `expireBans` would change something, so reads can skip the write transaction. */
  hasExpiredBans(room: Room) {
    const now = this.now()
    return Object.values(room.members).some(
      (participant) =>
        participant.banned && participant.bannedUntil !== undefined && participant.bannedUntil <= now,
    )
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
  private byMajority(room: Room, proposal: Proposal) {
    return proposal.type === 'restore'
      ? room.restoreByMajority === true
      : room.banByMajority === true
  }
  /** Members who may agree with this proposal. The ban target is left out. */
  private voters(room: Room, proposal: Proposal) {
    return Object.values(room.members).filter(
      (member) =>
        member.contributions > 0 &&
        !member.banned &&
        !(proposal.type === 'ban' && member.id === proposal.targetId),
    )
  }
  private canAgree(room: Room, proposal: Proposal, member: Member) {
    return this.voters(room, proposal).some((voter) => voter.id === member.id)
  }
  /** Agreement count shown to the owner, and the majority line when voting decides. */
  tally(room: Room, proposal: Proposal) {
    const voters = this.voters(room, proposal).map((member) => member.id)
    const supporters = (proposal.supporters ?? []).filter((id) => voters.includes(id))
    return {
      supporters: supporters.length,
      voters: voters.length,
      needed: Math.floor(voters.length / 2) + 1,
    }
  }
  /** Public proposals with their agreement counts. */
  publicProposals(room: Room) {
    return room.proposals.map((proposal) => ({
      ...proposal,
      supporters: proposal.supporters ?? [],
      byMajority: this.byMajority(room, proposal),
      tally: this.tally(room, proposal),
    }))
  }
  private closeIfMajority(room: Room, proposal: Proposal, actorId: string) {
    if (!this.byMajority(room, proposal) || proposal.status !== 'pending') return
    const tally = this.tally(room, proposal)
    if (tally.supporters < tally.needed) return
    proposal.status = 'accepted'
    proposal.decidedAt = this.now()
    proposal.decidedBy = null
    proposal.decidedByMajority = true
    this.history.event(room, 'majority-decision', actorId, {
      proposalId: proposal.id,
      type: proposal.type,
      supporters: tally.supporters,
      voters: tally.voters,
    })
    this.enact(room, proposal, null)
  }
  propose(
    room: Room,
    user: User,
    participant: Member,
    body: Record<string, unknown>,
  ) {
    if (!participant.contributions && user.id !== room.creatorId)
      fail(403, 'Contribua antes de propor uma decisão.')
    const type = mode(body.type, ['ban', 'restore'])
    if (room.proposals.some((p) => p.status === 'pending' && p.type === type))
      fail(
        409,
        type === 'restore'
          ? 'Já existe uma proposta de restauração pendente.'
          : 'Já existe uma proposta de suspensão pendente.',
      )
    let targetId: string
    if (type === 'restore') {
      targetId = text(body.snapshotId, 1, 100, 'Checkpoint')
      this.checkpoints.find(room, targetId)
    } else {
      targetId = text(body.targetId, 1, 100, 'Alvo')
      if (
        !room.members[targetId] ||
        room.members[targetId].banned ||
        targetId === room.creatorId
      )
        fail(400, 'Alvo de banimento inválido.')
    }
    const proposal: Proposal = {
      id: randomUUID(),
      type,
      targetId,
      reason: text(body.reason, 3, 500, 'Motivo'),
      actorId: user.id,
      status: 'pending',
      createdAt: this.now(),
      supporters: [],
    }
    if (this.canAgree(room, proposal, participant)) proposal.supporters!.push(user.id)
    room.proposals.push(proposal)
    this.history.event(room, 'proposal', user.id, {
      proposalId: proposal.id,
      type,
      targetId,
    })
    if (this.byMajority(room, proposal)) {
      this.closeIfMajority(room, proposal, user.id)
    } else if (user.id === room.creatorId) {
      proposal.status = 'accepted'
      proposal.decidedAt = this.now()
      proposal.decidedBy = user.id
      this.enact(room, proposal, user.id)
    }
    return { proposal }
  }
  support(room: Room, user: User, participant: Member, proposal: Proposal) {
    if (!this.canAgree(room, proposal, participant))
      fail(
        403,
        proposal.type === 'ban' && proposal.targetId === user.id
          ? 'Você não pode apoiar a própria suspensão.'
          : 'Contribua antes de concordar com uma proposta.',
      )
    proposal.supporters ??= []
    if (proposal.supporters.includes(user.id)) fail(409, 'Você já concordou com esta proposta.')
    proposal.supporters.push(user.id)
    this.history.event(room, 'proposal-support', user.id, {
      proposalId: proposal.id,
      type: proposal.type,
    })
    this.closeIfMajority(room, proposal, user.id)
    this.runtime.afterAction(room)
    return { ok: true, status: proposal.status, tally: this.tally(room, proposal) }
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
    if (accept && this.byMajority(room, proposal))
      fail(409, 'Nesta sala a maioria dos contribuidores decide esta proposta.')
    const reason = text(body.reason, 3, 500, 'Motivo')
    proposal.status = accept ? 'accepted' : 'rejected'
    proposal.decidedAt = this.now()
    proposal.decidedBy = user.id
    proposal.decisionReason = reason
    this.history.event(room, 'bdfl-decision', user.id, {
      proposalId: proposal.id,
      accept,
      reason,
      supporters: this.tally(room, proposal).supporters,
    })
    if (accept) this.enact(room, proposal, user.id)
    return { ok: true }
  }
}
