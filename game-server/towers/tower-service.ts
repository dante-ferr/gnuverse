import { randomUUID } from 'node:crypto'
import type { Member, Rules, Tower, User } from '../domain/types.ts'
import { fail, text, integer, number, mode } from '../domain/validation.ts'
import { GameStore } from '../persistence/game-store.ts'
import { WalletService } from '../economy/wallet-service.ts'
import { SimulationCoordinator } from '../runtime/simulation-coordinator.ts'
import { WindService } from '../wind/wind-service.ts'
import { HistoryService } from './history-service.ts'

export class TowerService {
  private store: GameStore
  private rules: Readonly<Rules>
  private now: () => number
  private wallet: WalletService
  private runtime: SimulationCoordinator
  private history: HistoryService
  private wind: WindService
  constructor(
    store: GameStore,
    rules: Readonly<Rules>,
    now: () => number,
    wallet: WalletService,
    runtime: SimulationCoordinator,
    history: HistoryService,
    wind: WindService,
  ) {
    this.store = store
    this.rules = rules
    this.now = now
    this.wallet = wallet
    this.runtime = runtime
    this.history = history
    this.wind = wind
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
    return {
      id: tower.id,
      name: tower.name,
      creatorId: tower.creatorId,
      allowCreatorBan: tower.allowCreatorBan === true,
      cost: tower.cost,
      banMode: tower.banMode,
      restoreMode: tower.restoreMode,
      eligibilityMode: tower.eligibilityMode,
      minContributions: tower.minContributions,
      blockCount: tower.frame.blocks.length,
      blockIntervalMs: tower.blockIntervalMs,
      checkpointEveryBlocks: tower.checkpointEveryBlocks,
      windMinBlocks: tower.windMinBlocks,
      windEveryBlocks: tower.windEveryBlocks,
      placementCount: tower.placementCount,
      nextWindAt: tower.nextWindAt,
    }
  }
  detail(tower: Tower) {
    return {
      tower: this.publicTower(tower),
      frame: this.runtime.frame(tower),
      snapshots: tower.snapshots,
      events: tower.events,
      members: Object.values(tower.members),
      proposals: tower.proposals,
      rules: this.rules,
    }
  }
  create(user: User, body: Record<string, unknown>) {
    if (
      Object.keys(this.store.state.towers).length >= this.rules.maxTowers ||
      Object.values(this.store.state.towers).filter(
        (t) => t.creatorId === user.id,
      ).length >= 10
    )
      fail(409, 'Limite de torres atingido.')
    if (
      body.allowCreatorBan !== undefined &&
      typeof body.allowCreatorBan !== 'boolean'
    )
      fail(400, 'A opção de suspensão do criador deve ser booleana.')
    const tower: Tower = {
      id: randomUUID(),
      name: text(body.name, 3, 60, 'Nome'),
      creatorId: user.id,
      allowCreatorBan: body.allowCreatorBan === true,
      cost: integer(
        body.cost ?? this.rules.defaultCost,
        0,
        this.rules.maxCost,
        'Custo',
      ),
      banMode: mode(body.banMode, ['vote', 'bdfl'], 'vote'),
      restoreMode: mode(body.restoreMode, ['vote', 'bdfl'], 'vote'),
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
      blockIntervalMs: integer(body.blockIntervalMs ?? this.rules.cooldownMs, 0, 86_400_000, 'Intervalo entre blocos'),
      checkpointEveryBlocks: integer(body.checkpointEveryBlocks ?? 5, 1, 1_000_000, 'Intervalo de checkpoints'),
      lastPlacementAt: null,
      lastCheckpointPlacementCount: 0,
      pendingSnapshot: false,
      windMinBlocks:
        body.windMinBlocks === undefined
          ? this.rules.windMinBlocks
          : integer(body.windMinBlocks, 1, 1_000_000, 'Primeira ventania'),
      windEveryBlocks:
        body.windEveryBlocks === undefined
          ? this.rules.windEveryBlocks
          : integer(
              body.windEveryBlocks,
              1,
              1_000_000,
              'Intervalo de ventanias',
            ),
      lastWindPlacementCount: null,
      placementCount: 0,
      nextWindAt: this.rules.windMinBlocks,
      wind: null,
      frame: { blocks: [], settled: true, tick: 0 },
    }
    tower.nextWindAt = tower.windMinBlocks
    tower.frame = this.runtime.simulation(tower).read()
    this.member(tower, user)
    this.store.state.towers[tower.id] = tower
    this.history.event(tower, 'created', user.id, {
      allowCreatorBan: tower.allowCreatorBan,
      cost: tower.cost,
      banMode: tower.banMode,
      restoreMode: tower.restoreMode,
      eligibilityMode: tower.eligibilityMode,
      minContributions: tower.minContributions,
      blockIntervalMs: tower.blockIntervalMs,
      checkpointEveryBlocks: tower.checkpointEveryBlocks,
      windMinBlocks: tower.windMinBlocks,
      windEveryBlocks: tower.windEveryBlocks,
    })
    this.history.snapshot(tower, user.id, 'Torre criada')
    return { tower: this.publicTower(tower) }
  }
  settings(tower: Tower, user: User, body: Record<string, unknown>) {
    if (Object.hasOwn(body, 'allowCreatorBan'))
      fail(
        400,
        'A opção de suspensão do criador é imutável após criar a torre.',
      )
    if (user.id !== tower.creatorId)
      fail(403, 'Apenas o criador pode alterar as regras.')
    if (
      tower.proposals.some(
        (proposal) =>
          proposal.status === 'pending' ||
          proposal.executionStatus === 'deferred',
      )
    )
      fail(409, 'Aguarde a proposta pendente antes de alterar regras.')
    const reason = text(body.reason, 3, 500, 'Justificativa')
    const before = {
      cost: tower.cost,
      banMode: tower.banMode,
      restoreMode: tower.restoreMode,
      eligibilityMode: tower.eligibilityMode,
      minContributions: tower.minContributions,
      blockIntervalMs: tower.blockIntervalMs,
      checkpointEveryBlocks: tower.checkpointEveryBlocks,
      windMinBlocks: tower.windMinBlocks,
      windEveryBlocks: tower.windEveryBlocks,
    }
    const after = {
      blockIntervalMs: body.blockIntervalMs === undefined ? tower.blockIntervalMs
        : integer(body.blockIntervalMs, 0, 86_400_000, 'Intervalo entre blocos'),
      checkpointEveryBlocks: body.checkpointEveryBlocks === undefined ? tower.checkpointEveryBlocks
        : integer(body.checkpointEveryBlocks, 1, 1_000_000, 'Intervalo de checkpoints'),
      cost:
        body.cost === undefined
          ? tower.cost
          : integer(body.cost, 0, this.rules.maxCost, 'Custo'),
      banMode:
        body.banMode === undefined
          ? tower.banMode
          : mode(body.banMode, ['vote', 'bdfl']),
      restoreMode:
        body.restoreMode === undefined
          ? tower.restoreMode
          : mode(body.restoreMode, ['vote', 'bdfl']),
      eligibilityMode:
        body.eligibilityMode === undefined
          ? tower.eligibilityMode
          : mode(body.eligibilityMode, ['automatic', 'manual']),
      windMinBlocks:
        body.windMinBlocks === undefined
          ? tower.windMinBlocks
          : integer(body.windMinBlocks, 1, 1_000_000, 'Primeira ventania'),
      windEveryBlocks:
        body.windEveryBlocks === undefined
          ? tower.windEveryBlocks
          : integer(
              body.windEveryBlocks,
              1,
              1_000_000,
              'Intervalo de ventanias',
            ),
      minContributions:
        body.minContributions === undefined
          ? tower.minContributions
          : integer(body.minContributions, 1, 1000, 'Contribuições mínimas'),
    }
    if (Object.entries(before).every(([key, value]) => after[key as keyof typeof after] === value))
      fail(400, 'Escolha ao menos uma alteração.')
    const frequencyChanged =
      before.windMinBlocks !== after.windMinBlocks ||
      before.windEveryBlocks !== after.windEveryBlocks
    if (frequencyChanged && tower.wind)
      fail(409, 'Aguarde a ventania terminar antes de alterar sua frequência.')
    if (before.checkpointEveryBlocks !== after.checkpointEveryBlocks && tower.pendingSnapshot)
      fail(409, 'Aguarde o checkpoint antes de alterar seu intervalo.')
    const previousNextWindAt = tower.nextWindAt
    Object.assign(tower, after)
    tower.pendingSnapshot = tower.placementCount - tower.lastCheckpointPlacementCount >= tower.checkpointEveryBlocks
    if (frequencyChanged) this.wind.recalculate(tower)
    if (tower.eligibilityMode === 'automatic')
      for (const participant of Object.values(tower.members))
        participant.eligible =
          participant.id === tower.creatorId ||
          participant.contributions >= tower.minContributions
    this.history.event(tower, 'settings', user.id, {
      before,
      after,
      reason,
      windSchedule: { before: previousNextWindAt, after: tower.nextWindAt },
      eligibilityPolicy:
        tower.eligibilityMode === 'automatic'
          ? 'recomputed-from-contributions'
          : 'preserve-current-until-manual-change',
    })
    return { tower: this.publicTower(tower) }
  }
  place(
    tower: Tower,
    user: User,
    participant: Member,
    body: Record<string, unknown>,
  ) {
    if (tower.wind)
      fail(409, 'Aguarde a ventania terminar e a torre estabilizar.')
    if (tower.pendingSnapshot)
      fail(409, 'Aguarde a torre estabilizar para salvar o checkpoint.')
    if (
      tower.proposals.some(
        (proposal) => proposal.executionStatus === 'deferred',
      )
    )
      fail(409, 'Aguarde a restauração aprovada ser executada.')
    if (
      tower.lastPlacementAt !== null &&
      this.now() - tower.lastPlacementAt < tower.blockIntervalMs
    )
      fail(429, 'Aguarde o intervalo entre blocos.')
    this.wallet.read(user)
    if (user.balance < tower.cost) fail(409, 'Moedas insuficientes.')
    if (tower.frame.blocks.length >= this.rules.maxBlocks)
      fail(409, 'A torre atingiu o limite de blocos.')
    const block = {
      id: randomUUID(),
      authorId: user.id,
      kind: mode(body.kind, ['square', 'wide', 'tall'], 'square'),
      x: number(body.x, 60, 940, 'Posição X'),
      y: number(body.y, 40, 680, 'Posição Y'),
      angle: number(body.angle ?? 0, -Math.PI, Math.PI, 'Ângulo'),
      color: typeof body.color === 'string' ? body.color : '#57c79e',
    }
    if (
      (body.color !== undefined && typeof body.color !== 'string') ||
      !/^#[0-9a-fA-F]{6}$/.test(block.color)
    )
      fail(400, 'Cor inválida.')
    const placement = this.runtime.simulation(tower).place(block)
    if (!placement.ok) {
      const messages = {
        busy: 'Aguarde a torre estabilizar.',
        overlap: 'Este espaço já está ocupado.',
        bounds: 'O bloco precisa caber no cenário.',
        limit: 'Limite de blocos atingido.',
        invalid: 'Bloco inválido.',
        duplicate: 'Bloco repetido.',
      }
      fail(409, messages[placement.error])
    }
    if (!this.rules.infiniteCoins) user.balance -= tower.cost
    user.lastAction = this.now()
    tower.lastPlacementAt = this.now()
    participant.contributions++
    this.wind.placed(tower, user.id)
    if (
      tower.eligibilityMode === 'automatic' &&
      participant.contributions >= tower.minContributions
    )
      participant.eligible = true
    tower.frame = this.runtime.simulation(tower).read()
    tower.pendingSnapshot = tower.placementCount - tower.lastCheckpointPlacementCount >= tower.checkpointEveryBlocks
    tower.lastActorId = user.id
    this.history.event(tower, 'block-placed', user.id, {
      blockId: block.id,
      cost: tower.cost,
      contributions: participant.contributions,
    })
    return { wallet: this.wallet.read(user) }
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
      fail(400, 'Escolha um contribuidor da torre.')
    if (typeof body.eligible !== 'boolean') fail(400, 'Habilitação inválida.')
    target.eligible = body.eligible
    this.history.event(tower, 'eligibility', user.id, {
      targetId: target.id,
      eligible: target.eligible,
    })
    return { ok: true }
  }
}
