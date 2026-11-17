import { randomUUID } from 'node:crypto'
import type { Member, Rules, Tower, User } from '../domain/types.ts'
import { fail, text, integer, mode } from '../domain/validation.ts'
import { GameStore } from '../persistence/game-store.ts'
import { WalletService } from '../economy/wallet-service.ts'
import { SimulationCoordinator } from '../runtime/simulation-coordinator.ts'
import { HistoryService } from './history-service.ts'
import { isDirection } from '../pipeline/geometry/direction.ts'
import { Match } from '../pipeline/world/match.ts'
import { isPipelineFrame } from '../pipeline/world/frame.ts'
import { canManageTower } from '../../core/authz/policy.ts'

export class TowerService {
  private store: GameStore
  private rules: Readonly<Rules>
  private now: () => number
  private wallet: WalletService
  private runtime: SimulationCoordinator
  private history: HistoryService
  constructor(
    store: GameStore,
    rules: Readonly<Rules>,
    now: () => number,
    wallet: WalletService,
    runtime: SimulationCoordinator,
    history: HistoryService,
  ) {
    this.store = store
    this.rules = rules
    this.now = now
    this.wallet = wallet
    this.runtime = runtime
    this.history = history
  }
  member(tower: Tower, user: User): Member {
    return (tower.members[user.id] ??= {
      id: user.id,
      nickname: user.nickname,
      contributions: 0,
      eligible: user.id === tower.creatorId,
      banned: false,
    })
  }
  publicTower(tower: Tower) {
    const belts = isPipelineFrame(tower.frame) ? tower.frame.belts.length : 0
    return {
      id: tower.id,
      name: tower.name,
      creatorId: tower.creatorId,
      allowCreatorBan: tower.allowCreatorBan === true,
      cost: tower.cost,
      eligibilityMode: tower.eligibilityMode,
      minContributions: tower.minContributions,
      segmentCount: belts,
      actionCount: tower.actionCount,
      outcome: isPipelineFrame(tower.frame) && !tower.frame.crashed ? 'playing' : 'lost',
    }
  }
  detail(tower: Tower) {
    return {
      tower: this.publicTower(tower),
      frame: this.runtime.publicFrame(tower),
      snapshots: tower.snapshots,
      events: tower.events,
      members: Object.values(tower.members),
      proposals: tower.proposals,
      rules: this.rules,
    }
  }
  statusPayload(tower: Tower, user: User) {
    const frame = this.runtime.publicFrame(tower)
    return {
      id: tower.id,
      crashed: frame.crashed,
      stability: frame.stability,
      deliveries: frame.deliveries,
      tick: frame.tick,
      coins: this.wallet.read(user).balance,
    }
  }
  create(user: User, body: Record<string, unknown>) {
    if (
      Object.keys(this.store.state.towers).length >= this.rules.maxTowers ||
      Object.values(this.store.state.towers).filter(
        (t) => t.creatorId === user.id,
      ).length >= 10
    )
      fail(409, 'Limite de salas atingido.')
    if (
      body.allowCreatorBan !== undefined &&
      typeof body.allowCreatorBan !== 'boolean'
    )
      fail(400, 'A opção de suspensão do criador deve ser booleana.')
    const towerId = randomUUID()
    const tower: Tower = {
      id: towerId,
      name: text(body.name, 3, 60, 'Nome'),
      creatorId: user.id,
      allowCreatorBan: body.allowCreatorBan === true,
      cost: integer(
        body.cost ?? this.rules.defaultCost,
        0,
        this.rules.maxCost,
        'Custo',
      ),
      eligibilityMode: mode(
        body.eligibilityMode,
        ['automatic', 'manual'],
        'automatic',
      ),
      minContributions: integer(
        body.minContributions ?? this.rules.minContributions,
        1,
        1000,
        'Contribuições mínimas',
      ),
      members: {},
      snapshots: [],
      events: [],
      proposals: [],
      segmentCount: 0,
      actionCount: 0,
      frame: Match.create(towerId, this.rules.pipeline).toFrame(),
    }
    this.member(tower, user)
    this.store.state.towers[tower.id] = tower
    this.history.event(tower, 'created', user.id, {
      allowCreatorBan: tower.allowCreatorBan,
      cost: tower.cost,
      eligibilityMode: tower.eligibilityMode,
      minContributions: tower.minContributions,
    })
    this.history.snapshot(tower, user.id, 'Árvore criada')
    return { tower: this.publicTower(tower) }
  }
  settings(tower: Tower, user: User, body: Record<string, unknown>) {
    if (!canManageTower({ id: user.id, roles: user.roles ?? [] }, 'update', tower.creatorId))
      fail(403, 'Apenas o criador pode alterar as regras.')
    if (Object.hasOwn(body, 'allowCreatorBan'))
      fail(400, 'A opção de suspensão do criador é imutável após criar a sala.')
    if (
      tower.proposals.some((proposal) => proposal.status === 'pending')
    )
      fail(409, 'Aguarde a proposta pendente antes de alterar regras.')
    const reason = text(body.reason, 3, 500, 'Justificativa')
    const before = {
      name: tower.name,
      cost: tower.cost,
      eligibilityMode: tower.eligibilityMode,
      minContributions: tower.minContributions,
    }
    const after = {
      name: body.name === undefined ? tower.name : text(body.name, 3, 60, 'Nome'),
      cost:
        body.cost === undefined
          ? tower.cost
          : integer(body.cost, 0, this.rules.maxCost, 'Custo'),
      eligibilityMode:
        body.eligibilityMode === undefined
          ? tower.eligibilityMode
          : mode(body.eligibilityMode, ['automatic', 'manual']),
      minContributions:
        body.minContributions === undefined
          ? tower.minContributions
          : integer(body.minContributions, 1, 1000, 'Contribuições mínimas'),
    }
    if (Object.entries(before).every(([key, value]) => after[key as keyof typeof after] === value))
      fail(400, 'Escolha ao menos uma alteração.')
    Object.assign(tower, after)
    if (tower.eligibilityMode === 'automatic')
      for (const participant of Object.values(tower.members))
        participant.eligible =
          participant.id === tower.creatorId ||
          participant.contributions >= tower.minContributions
    this.history.event(tower, 'settings', user.id, { before, after, reason })
    return { tower: this.publicTower(tower) }
  }
  place(tower: Tower, user: User, participant: Member, body: Record<string, unknown>) {
    const match = this.editable(tower)
    const raw = body.cells
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 64)
      fail(400, 'Informe as células da esteira.')
    const cells = raw.map((cell) => this.stroke(cell, match.width, match.height))
    const error = match.place(cells, { id: user.id, nickname: user.nickname })
    if (error) fail(409, error)
    return this.commit(tower, user, participant, match, 'place')
  }
  removeBelt(tower: Tower, user: User, participant: Member, body: Record<string, unknown>) {
    const match = this.editable(tower)
    const error = match.remove(
      {
        x: integer(body.x, 0, match.width - 1, 'X'),
        y: integer(body.y, 0, match.height - 1, 'Y'),
      },
      { id: user.id, nickname: user.nickname },
    )
    if (error) fail(409, error)
    return this.commit(tower, user, participant, match, 'remove')
  }
  join(tower: Tower, user: User) {
    const match = this.editable(tower)
    match.noteCollaborator({ id: user.id, nickname: user.nickname })
    tower.frame = match.toFrame()
    this.member(tower, user)
    this.runtime.afterAction(tower)
    return { frame: tower.frame }
  }
  private editable(tower: Tower) {
    if (!isPipelineFrame(tower.frame))
      fail(409, 'Esta sala é de uma versão anterior.')
    if (tower.frame.crashed) fail(409, 'O sistema já caiu.')
    return Match.fromFrame(tower.frame, this.rules.pipeline)
  }
  private stroke(cell: unknown, width: number, height: number) {
    if (!cell || typeof cell !== 'object') fail(400, 'Célula inválida.')
    const record = cell as Record<string, unknown>
    if (!isDirection(record.direction)) fail(400, 'Direção inválida.')
    return {
      x: integer(record.x, 0, width - 1, 'X'),
      y: integer(record.y, 0, height - 1, 'Y'),
      direction: record.direction,
    }
  }
  private commit(tower: Tower, user: User, participant: Member, match: Match, eventType: string) {
    tower.frame = match.toFrame()
    participant.contributions++
    tower.actionCount++
    tower.lastActorId = user.id
    tower.segmentCount = tower.frame.belts.length
    if (
      tower.eligibilityMode === 'automatic' &&
      participant.contributions >= tower.minContributions
    )
      participant.eligible = true
    this.history.event(tower, eventType, user.id, { belts: tower.segmentCount })
    this.runtime.afterAction(tower)
    return { frame: tower.frame }
  }
  eligibility(
    tower: Tower,
    user: User,
    targetId: string,
    body: Record<string, unknown>,
  ) {
    if (user.id !== tower.creatorId || tower.eligibilityMode !== 'manual')
      fail(403, 'Apenas o BDFL pode habilitar manualmente.')
    const target = tower.members[targetId]
    if (!target || !target.contributions)
      fail(400, 'Escolha um contribuidor da árvore.')
    if (typeof body.eligible !== 'boolean') fail(400, 'Habilitação inválida.')
    target.eligible = body.eligible
    this.history.event(tower, 'eligibility', user.id, {
      targetId: target.id,
      eligible: target.eligible,
    })
    return { ok: true }
  }
}