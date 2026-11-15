import { randomUUID } from 'node:crypto'
import type { Member, Proposal, Rules, Tower, User } from '../domain/types.ts'
import { fail, text, mode } from '../domain/validation.ts'
import { SimulationCoordinator } from '../runtime/simulation-coordinator.ts'
import { HistoryService } from '../towers/history-service.ts'

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
  private enact(tower: Tower, proposal: Proposal, actorId: string | null) {
    tower.members[proposal.targetId].banned = true
    tower.members[proposal.targetId].bannedUntil =
      this.now() + this.rules.banDurationMs
    this.history.event(tower, 'ban', actorId, {
      targetId: proposal.targetId,
      proposalId: proposal.id,
      reason: proposal.decisionReason ?? proposal.reason,
    })
    proposal.executionStatus = 'executed'
    proposal.executedAt = this.now()
  }
  expireBans(tower: Tower) {
    for (const participant of Object.values(tower.members))
      if (
        participant.banned &&
        participant.bannedUntil !== undefined &&
        participant.bannedUntil <= this.now()
      ) {
        participant.banned = false
        this.history.event(tower, 'ban-expired', null, {
          targetId: participant.id,
        })
      }
  }
  propose(
    tower: Tower,
    user: User,
    participant: Member,
    body: Record<string, unknown>,
  ) {
    if (!participant.contributions && user.id !== tower.creatorId)
      fail(403, 'Contribua antes de propor uma decisão.')
    if (tower.proposals.some((p) => p.status === 'pending'))
      fail(409, 'Já existe uma proposta pendente.')
    const type = mode(body.type, ['ban'])
    const targetId = text(body.targetId, 1, 100, 'Alvo')
    if (
      !tower.members[targetId] ||
      tower.members[targetId].banned ||
      (targetId === tower.creatorId && tower.allowCreatorBan !== true)
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
    tower.proposals.push(proposal)
    this.history.event(tower, 'proposal', user.id, {
      proposalId: proposal.id,
      type,
      targetId,
    })
    if (user.id === tower.creatorId) {
      proposal.status = 'accepted'
      proposal.decidedAt = this.now()
      proposal.decidedBy = user.id
      this.enact(tower, proposal, user.id)
    }
    return { proposal }
  }
  decide(
    tower: Tower,
    user: User,
    proposal: Proposal,
    body: Record<string, unknown>,
  ) {
    if (user.id !== tower.creatorId)
      fail(403, 'Somente o BDFL decide esta proposta.')
    const accept = body.accept === true
    const reason = text(body.reason, 3, 500, 'Motivo')
    proposal.status = accept ? 'accepted' : 'rejected'
    proposal.decidedAt = this.now()
    proposal.decidedBy = user.id
    proposal.decisionReason = reason
    this.history.event(tower, 'bdfl-decision', user.id, {
      proposalId: proposal.id,
      accept,
      reason,
    })
    if (accept) this.enact(tower, proposal, user.id)
    return { ok: true }
  }
}