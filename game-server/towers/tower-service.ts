import { randomUUID } from 'node:crypto'
import type { Member, Rules, Tower, User } from '../domain/types.ts'
import { fail, text, integer, number, mode } from '../domain/validation.ts'
import { GameStore } from '../persistence/game-store.ts'
import { WalletService } from '../economy/wallet-service.ts'
import { SimulationCoordinator } from '../runtime/simulation-coordinator.ts'
import { HistoryService } from './history-service.ts'
import { actionCosts, treeRules } from '../physics/tree-constants.ts'
import { createInitialTreeFrame } from '../physics/map-gen.ts'
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
    const segments = tower.frame.nodes.filter(
      (n) => n.parentId !== null && !n.broken,
    ).length
    return {
      id: tower.id,
      name: tower.name,
      creatorId: tower.creatorId,
      allowCreatorBan: tower.allowCreatorBan === true,
      cost: tower.cost,
      eligibilityMode: tower.eligibilityMode,
      minContributions: tower.minContributions,
      segmentCount: segments,
      actionCount: tower.actionCount,
      outcome: tower.frame.outcome,
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
      phase: frame.turn.phase,
      phaseRemainingMs: frame.phaseRemainingMs,
      energy: frame.energy,
      coins: this.wallet.read(user).balance,
      nodes: frame.nodes
        .filter((n) => !n.broken)
        .map((n) => ({
          id: n.id,
          x: n.x,
          y: n.y,
          parentId: n.parentId,
          leaf: n.leaf,
          fortified: n.fortified,
          authorName: n.authorName,
        })),
      firefly: frame.firefly,
      fireflyPosition: frame.fireflyPosition,
      flower: frame.flower,
      outcome: frame.outcome,
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
      frame: createInitialTreeFrame(this.now(), towerId),
    }
    this.member(tower, user)
    this.runtime.simulation(tower).restore(tower.frame)
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
  private ensurePlayable(tower: Tower) {
    if (tower.frame.outcome !== 'playing')
      fail(409, 'A partida já terminou.')
    if (tower.frame.turn.phase === 'physics')
      fail(409, 'Aguarde a fase de física.')
  }
  private spendAndRecord(
    tower: Tower,
    user: User,
    participant: Member,
    cost: number,
    eventType: string,
    detail: Record<string, unknown>,
  ) {
    this.wallet.read(user)
    if (!this.wallet.unlimited(user) && user.balance < cost)
      fail(409, 'Moedas insuficientes.')
    if (!this.wallet.unlimited(user)) user.balance -= cost
    user.lastAction = this.now()
    participant.contributions++
    tower.actionCount++
    tower.lastActorId = user.id
    tower.segmentCount = tower.frame.nodes.filter(
      (n) => n.parentId !== null && !n.broken,
    ).length
    if (
      tower.eligibilityMode === 'automatic' &&
      participant.contributions >= tower.minContributions
    )
      participant.eligible = true
    this.history.event(tower, eventType, user.id, detail)
    this.runtime.afterAction(tower)
    return { wallet: this.wallet.read(user), frame: this.runtime.publicFrame(tower) }
  }
  grow(tower: Tower, user: User, participant: Member, body: Record<string, unknown>) {
    this.ensurePlayable(tower)
    const world = treeRules()
    const costs = actionCosts(world)
    const segmentId = text(
      (body.segmentId ?? body.parentId) as string,
      1,
      100,
      'Segmento',
    )
    let anchorX: number
    let anchorY: number
    if (body.anchorX !== undefined && body.anchorY !== undefined) {
      anchorX = number(body.anchorX, 0, world.worldWidth, 'Âncora X')
      anchorY = number(body.anchorY, 0, world.worldHeight, 'Âncora Y')
    } else {
      const anchorNode = tower.frame.nodes.find(
        (n) => n.id === segmentId && !n.broken,
      )
      if (!anchorNode) fail(400, 'Segmento inválido.')
      anchorX = anchorNode.x
      anchorY = anchorNode.y
    }
    const x = number(body.x, 0, world.worldWidth, 'X')
    const y = number(body.y, 0, world.worldHeight, 'Y')
    const sim = this.runtime.simulation(tower)
    const result = sim.grow({
      segmentId,
      anchorX,
      anchorY,
      x,
      y,
      authorId: user.id,
      authorName: user.nickname,
    })
    if (!result.ok) fail(409, result.error)
    tower.frame = sim.read()
    return this.spendAndRecord(tower, user, participant, costs.grow, 'grow', {
      nodeId: result.nodeId,
      segmentId,
      cost: costs.grow,
    })
  }
  leaf(tower: Tower, user: User, participant: Member, body: Record<string, unknown>) {
    this.ensurePlayable(tower)
    const nodeId = text(body.nodeId, 1, 100, 'Nó')
    const sim = this.runtime.simulation(tower)
    const result = sim.placeLeaf(nodeId)
    if (!result.ok) fail(409, result.error)
    tower.frame = sim.read()
    const costs = actionCosts()
    return this.spendAndRecord(tower, user, participant, costs.leaf, 'leaf', {
      nodeId,
      cost: costs.leaf,
    })
  }
  fortify(tower: Tower, user: User, participant: Member, body: Record<string, unknown>) {
    this.ensurePlayable(tower)
    const nodeId = text(body.nodeId, 1, 100, 'Nó')
    const sim = this.runtime.simulation(tower)
    const result = sim.fortify(nodeId)
    if (!result.ok) fail(409, result.error)
    tower.frame = sim.read()
    const costs = actionCosts()
    return this.spendAndRecord(tower, user, participant, costs.fortify, 'fortify', {
      nodeId,
      cost: costs.fortify,
    })
  }
  prune(tower: Tower, user: User, participant: Member, body: Record<string, unknown>) {
    this.ensurePlayable(tower)
    const nodeId = text(body.nodeId, 1, 100, 'Nó')
    const sim = this.runtime.simulation(tower)
    const result = sim.prune(nodeId)
    if (!result.ok) fail(409, result.error)
    tower.frame = sim.read()
    const costs = actionCosts()
    return this.spendAndRecord(tower, user, participant, costs.prune, 'prune', {
      nodeId,
      cost: costs.prune,
    })
  }
  secondaryRoot(
    tower: Tower,
    user: User,
    participant: Member,
    body: Record<string, unknown>,
  ) {
    this.ensurePlayable(tower)
    const world = treeRules()
    const costs = actionCosts(world)
    const parentId = text(body.parentId, 1, 100, 'Nó pai')
    const x = number(body.x, 0, world.worldWidth, 'X')
    const y = number(body.y, 0, world.worldHeight, 'Y')
    const sim = this.runtime.simulation(tower)
    const result = sim.secondaryRoot(parentId, x, y)
    if (!result.ok) fail(409, result.error)
    tower.frame = sim.read()
    const created = tower.frame.nodes.find((n) => n.id === result.nodeId)
    if (created) {
      created.authorId = user.id
      created.authorName = user.nickname
    }
    return this.spendAndRecord(tower, user, participant, costs.root, 'secondary-root', {
      nodeId: result.nodeId,
      parentId,
      cost: costs.root,
    })
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