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
    if (proposal.type === 'ban') {
      tower.members[proposal.targetId].banned = true
      tower.members[proposal.targetId].bannedUntil =
        this.now() + this.rules.banDurationMs
      this.history.event(tower, 'ban', actorId, {
        targetId: proposal.targetId,
        proposalId: proposal.id,
        reason: proposal.decisionReason ?? proposal.reason,
      })
    } else {
      if (tower.wind) {
        if (proposal.executionStatus !== 'deferred')
          this.history.event(tower, 'restore-deferred', actorId, {
            proposalId: proposal.id,
            reason: 'Aguardar ventania e estabilização',
          })
        proposal.executionStatus = 'deferred'
        return
      }
      const target = tower.snapshots.find(
        (item) => item.id === proposal.targetId,
      )
      this.runtime.simulation(tower).restore(structuredClone(target!.blocks))
      tower.frame = this.runtime.simulation(tower).read()
      tower.pendingSnapshot = false
      tower.lastCheckpointPlacementCount = tower.placementCount
      this.history.event(tower, 'restore', actorId, {
        snapshotId: target!.id,
        proposalId: proposal.id,
        reason: proposal.decisionReason ?? proposal.reason,
      })
      this.history.snapshot(tower, actorId, `Restauração de ${target!.id}`)
    }
    proposal.executionStatus = 'executed'
    proposal.executedAt = this.now()
  }
  flushDeferred(tower: Tower) {
    if (tower.wind || !tower.frame.settled) return
    for (const proposal of tower.proposals)
      if (
        proposal.status === 'accepted' &&
        proposal.executionStatus === 'deferred'
      )
        this.enact(tower, proposal, proposal.decidedBy ?? null)
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
  finishVoting(tower: Tower) {
    this.expireBans(tower)
    for (const proposal of tower.proposals) {
      if (
        proposal.status !== 'pending' ||
        proposal.mode !== 'vote' ||
        this.now() < proposal.closesAt!
      )
        continue
      const votes = Object.values(proposal.votes)
      const yes = votes.filter((v) => v === 'for').length
      const no = votes.filter((v) => v === 'against').length
      const accepted =
        proposal.electorate.length > 0 &&
        votes.length / proposal.electorate.length >= proposal.rules.quorum &&
        yes + no > 0 &&
        yes / (yes + no) > proposal.rules.approval
      proposal.status = accepted ? 'accepted' : 'rejected'
      proposal.decidedAt = this.now()
      proposal.decidedBy = null
      this.history.event(tower, 'vote-result', null, {
        proposalId: proposal.id,
        accepted,
        participation: votes.length,
        for: yes,
        against: no,
        abstain: votes.length - yes - no,
      })
      if (accepted) this.enact(tower, proposal, null)
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
    if (
      tower.proposals.some(
        (p) => p.status === 'pending' || p.executionStatus === 'deferred',
      )
    )
      fail(409, 'Já existe uma proposta pendente.')
    const type = mode(body.type, ['ban', 'restore'])
    const targetId = text(body.targetId, 1, 100, 'Alvo')
    if (
      type === 'ban' &&
      (!tower.members[targetId] ||
        tower.members[targetId].banned ||
        (targetId === tower.creatorId &&
          !(tower.allowCreatorBan === true && tower.banMode === 'vote')))
    )
      fail(400, 'Alvo de banimento inválido.')
    if (
      type === 'restore' &&
      !tower.snapshots.some((item) => item.id === targetId)
    )
      fail(400, 'Versão não encontrada.')
    const governanceMode = type === 'ban' ? tower.banMode : tower.restoreMode
    const proposal: Proposal = {
      id: randomUUID(),
      type,
      targetId,
      reason: text(body.reason, 3, 500, 'Motivo'),
      actorId: user.id,
      status: 'pending',
      mode: governanceMode,
      createdAt: this.now(),
      closesAt:
        governanceMode === 'vote'
          ? this.now() + this.rules.proposalDurationMs
          : null,
      electorate: Object.values(tower.members)
        .filter((m) => m.eligible && !m.banned)
        .map((m) => m.id),
      votes: {},
      rules: {
        quorum: this.rules.quorum,
        approval: this.rules.approval,
        voteChanges: this.rules.voteChanges,
      },
    }
    tower.proposals.push(proposal)
    this.history.event(tower, 'proposal', user.id, {
      proposalId: proposal.id,
      type,
      targetId,
      mode: governanceMode,
      reason: proposal.reason,
    })
    return { proposal }
  }
  vote(
    tower: Tower,
    user: User,
    proposal: Proposal,
    body: Record<string, unknown>,
  ) {
    if (proposal.mode !== 'vote' || !proposal.electorate.includes(user.id))
      fail(403, 'Você não integra o eleitorado desta proposta.')
    if (proposal.votes[user.id] && !proposal.rules.voteChanges)
      fail(409, 'Voto já registrado.')
    proposal.votes[user.id] = mode(body.choice, ['for', 'against', 'abstain'])
    this.history.event(tower, 'vote', user.id, {
      proposalId: proposal.id,
      choice: proposal.votes[user.id],
    })
    return { proposal }
  }
  decide(
    tower: Tower,
    user: User,
    proposal: Proposal,
    body: Record<string, unknown>,
  ) {
    if (proposal.mode !== 'bdfl' || user.id !== tower.creatorId)
      fail(403, 'Esta decisão cabe ao BDFL na modalidade BDFL.')
    if (typeof body.accept !== 'boolean') fail(400, 'Decisão inválida.')
    proposal.decisionReason = text(body.reason, 3, 500, 'Justificativa')
    proposal.decidedAt = this.now()
    proposal.decidedBy = user.id
    proposal.status = body.accept ? 'accepted' : 'rejected'
    this.history.event(tower, 'bdfl-decision', user.id, {
      proposalId: proposal.id,
      accepted: body.accept,
      reason: proposal.decisionReason,
    })
    if (body.accept) this.enact(tower, proposal, user.id)
    return { proposal }
  }
}
