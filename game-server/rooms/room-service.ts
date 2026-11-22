import { randomUUID } from 'node:crypto'
import type { ChatMessage, Member, Rules, Room, User } from '../domain/types.ts'
import { fail, text, integer, mode } from '../domain/validation.ts'
import { GameStore } from '../persistence/game-store.ts'
import { machineListPrice, speedDowngradeRefund, structureRefund } from '../economy/prices.ts'
import { WalletService } from '../economy/wallet-service.ts'
import { SimulationCoordinator } from '../runtime/simulation-coordinator.ts'
import { HistoryService } from './history-service.ts'
import { isDirection } from '../pipeline/geometry/direction.ts'
import { Match } from '../pipeline/world/match.ts'
import type { MachinePlaceRequest } from '../pipeline/world/edit/machine-editor.ts'
import { isPipelineFrame } from '../pipeline/world/frame.ts'
import { canManageRoom } from '../../core/authz/policy.ts'
import { forceAdvance } from '../pipeline/world/progression/unlock.ts'
import {
  applyChunkContribution,
  quoteChunkContribution,
  settleFundedPledges,
} from '../pipeline/world/chunks/purchase.ts'
import {
  applyCoreContribution,
  quoteCoreContribution,
  settleFundedCorePledges,
} from '../pipeline/world/chunks/core-purchase.ts'
import { recordRoomSpend } from '../economy/room-spend.ts'

export class RoomService {
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
  member(room: Room, user: User): Member {
    return (room.members[user.id] ??= {
      id: user.id,
      nickname: user.nickname,
      contributions: 0,
      eligible: user.id === room.creatorId,
      banned: false,
    })
  }
  publicRoom(room: Room) {
    const frame = isPipelineFrame(room.frame) ? room.frame : null
    const belts = frame ? frame.belts.length : 0
    return {
      id: room.id,
      name: room.name,
      creatorId: room.creatorId,
      allowCreatorBan: room.allowCreatorBan === true,
      cost: room.cost,
      eligibilityMode: room.eligibilityMode,
      minContributions: room.minContributions,
      beltCount: belts,
      deliveries: frame?.deliveries ?? 0,
      actionCount: room.actionCount,
      outcome: frame ? 'playing' : 'lost',
    }
  }
  detail(room: Room) {
    return {
      room: this.publicRoom(room),
      frame: this.runtime.publicFrame(room),
      snapshots: room.snapshots,
      events: room.events,
      members: Object.values(room.members),
      chat: room.chat ?? [],
      proposals: room.proposals,
      rules: this.rules,
    }
  }
  statusPayload(room: Room, user: User) {
    const frame = this.runtime.publicFrame(room)
    return {
      id: room.id,
      deliveries: frame.deliveries,
      tick: frame.tick,
      coins: this.wallet.read(user).balance,
    }
  }
  create(user: User, body: Record<string, unknown>) {
    if (Object.keys(this.store.state.rooms).length >= this.rules.maxRooms)
      fail(409, 'Limite de salas atingido.')
    const isAdmin = (user.roles ?? []).includes('admin')
    if (
      !isAdmin &&
      Object.values(this.store.state.rooms).filter(
        (room) => room.creatorId === user.id,
      ).length >= this.rules.maxRoomsPerCreator
    )
      fail(409, 'Você já criou o máximo de salas permitidas.')

    if (Object.hasOwn(body, 'allowCreatorBan') || Object.hasOwn(body, 'cost'))
      fail(400, 'Custo de referência e suspensão do criador não são mais suportados.')
    const sandbox = body.sandbox === true
    if (sandbox && (!this.rules.prototype || process.env.NODE_ENV === 'production')) {
      fail(403, 'Sala teste indisponível neste ambiente.')
    }
    const roomId = randomUUID()
    const defaultName = sandbox ? 'Sandbox elementos' : undefined
    const room: Room = {
      id: roomId,
      name: text(body.name ?? defaultName, 3, 60, 'Nome'),
      creatorId: user.id,
      allowCreatorBan: false,
      cost: 0,
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
      chat: [],
      snapshots: [],
      events: [],
      proposals: [],
      beltCount: 0,
      actionCount: 0,
      frame: (sandbox
        ? Match.createSandbox(roomId, this.rules.pipeline)
        : Match.create(roomId, this.rules.pipeline)
      ).toFrame(),
    }
    this.member(room, user)
    this.store.state.rooms[room.id] = room
    this.history.event(room, 'created', user.id, {
      eligibilityMode: room.eligibilityMode,
      minContributions: room.minContributions,
    })
    this.history.snapshot(room, user.id, 'Sala criada')
    return { room: this.publicRoom(room) }
  }
  settings(room: Room, user: User, body: Record<string, unknown>) {
    if (!canManageRoom({ id: user.id, roles: user.roles ?? [] }, 'update', room.creatorId))
      fail(403, 'Apenas o criador pode alterar as regras.')
    if (Object.hasOwn(body, 'allowCreatorBan') || Object.hasOwn(body, 'cost'))
      fail(400, 'Custo de referência e suspensão do criador não são mais suportados.')
    if (
      room.proposals.some((proposal) => proposal.status === 'pending')
    )
      fail(409, 'Aguarde a proposta pendente antes de alterar regras.')
    const reason = text(body.reason, 3, 500, 'Justificativa')
    const before = {
      name: room.name,
      eligibilityMode: room.eligibilityMode,
      minContributions: room.minContributions,
    }
    const after = {
      name: body.name === undefined ? room.name : text(body.name, 3, 60, 'Nome'),
      eligibilityMode:
        body.eligibilityMode === undefined
          ? room.eligibilityMode
          : mode(body.eligibilityMode, ['automatic', 'manual']),
      minContributions:
        body.minContributions === undefined
          ? room.minContributions
          : integer(body.minContributions, 1, 1000, 'Contribuições mínimas'),
    }
    if (Object.entries(before).every(([key, value]) => after[key as keyof typeof after] === value))
      fail(400, 'Escolha ao menos uma alteração.')
    Object.assign(room, after)
    if (room.eligibilityMode === 'automatic')
      for (const participant of Object.values(room.members))
        participant.eligible =
          participant.id === room.creatorId ||
          participant.contributions >= room.minContributions
    this.history.event(room, 'settings', user.id, { before, after, reason })
    return { room: this.publicRoom(room) }
  }
  placeMachine(room: Room, user: User, participant: Member, body: Record<string, unknown>) {
    const match = this.editable(room)
    const machineId = body.machineId
    if (!isDirection(body.facing)) fail(400, 'Direção inválida.')
    let spec: MachinePlaceRequest
    if (machineId === 'combiner_2' || machineId === 'combiner_3') {
      spec = {
        machineId,
        x: integer(body.x, 0, match.width - 1, 'X'),
        y: integer(body.y, 0, match.height - 1, 'Y'),
        facing: body.facing,
      }
    } else if (machineId === 'splitter') {
      spec = {
        machineId: 'splitter',
        x: integer(body.x, 0, match.width - 1, 'X'),
        y: integer(body.y, 0, match.height - 1, 'Y'),
        facing: body.facing,
      }
    } else if (machineId === 'trashcan') {
      spec = {
        machineId: 'trashcan',
        x: integer(body.x, 0, match.width - 1, 'X'),
        y: integer(body.y, 0, match.height - 1, 'Y'),
        facing: body.facing,
      }
    } else if (machineId === 'tunnel' || machineId === 'fast_tunnel') {
      spec = {
        machineId,
        entranceX: integer(body.entranceX, 0, match.width - 1, 'Entrada X'),
        entranceY: integer(body.entranceY, 0, match.height - 1, 'Entrada Y'),
        exitX: integer(body.exitX, 0, match.width - 1, 'Saída X'),
        exitY: integer(body.exitY, 0, match.height - 1, 'Saída Y'),
        facing: body.facing,
      }
    } else {
      fail(400, 'Máquina inválida.')
    }
    const placed = match.placeMachineBilling(spec, { id: user.id, nickname: user.nickname })
    if (placed.error) fail(409, placed.error)
    const listPrice = machineListPrice(match.rules, String(machineId))
    const cost = match.sandbox || !placed.billable ? 0 : listPrice
    const refund =
      match.sandbox || !placed.refund ? 0 : speedDowngradeRefund(match.rules, 'tunnel')
    const wallet = this.settle(user, cost, refund)
    if (cost > 0) recordRoomSpend(match, user.id, cost)
    const committed = this.commitMachine(room, user, participant, match, String(machineId), cost, refund)
    return { ...committed, wallet, cost, refund }
  }
  place(room: Room, user: User, participant: Member, body: Record<string, unknown>) {
    const match = this.editable(room)
    const raw = body.cells
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 64)
      fail(400, 'Informe as células da esteira.')
    const cells = raw.map((cell) => this.stroke(cell, match.width, match.height))
    const speedRaw = body.speed
    const speed =
      speedRaw === undefined
        ? 1
        : typeof speedRaw === 'number' && Number.isSafeInteger(speedRaw)
          ? speedRaw
          : NaN
    if (!Number.isSafeInteger(speed) || (speed !== 1 && speed !== match.rules.beltSpeedFast)) {
      fail(400, 'Velocidade da esteira inválida.')
    }
    const placed = match.placeBilling(cells, { id: user.id, nickname: user.nickname }, speed)
    if (placed.error) fail(409, placed.error)
    const unit = speed === match.rules.beltSpeedFast ? match.rules.fastBeltCost : match.rules.beltCost
    const cost = match.sandbox ? 0 : placed.billableCells * unit
    const refund = match.sandbox
      ? 0
      : placed.refundCells * speedDowngradeRefund(match.rules, 'belt')
    const wallet = this.settle(user, cost, refund)
    if (cost > 0) recordRoomSpend(match, user.id, cost)
    const structure = speed === match.rules.beltSpeedFast ? 'fast_belt' : 'belt'
    const committed = this.commit(room, user, participant, match, 'place', structure, {
      cost,
      refund,
    })
    return { ...committed, wallet, cost, refund }
  }
  removeBelt(room: Room, user: User, participant: Member, body: Record<string, unknown>) {
    const match = this.editable(room)
    const result = match.remove(
      {
        x: integer(body.x, 0, match.width - 1, 'X'),
        y: integer(body.y, 0, match.height - 1, 'Y'),
      },
      { id: user.id, nickname: user.nickname },
    )
    if (result.error) fail(409, result.error)
    const refund =
      match.sandbox || result.authorId !== user.id
        ? 0
        : structureRefund(match.rules, result.listPrice)
    const wallet = this.refund(user, refund)
    const structure =
      result.kind === 'belt'
        ? result.speed === match.rules.beltSpeedFast
          ? 'fast_belt'
          : 'belt'
        : result.kind === 'tunnel'
          ? result.speed === match.rules.beltSpeedFast
            ? 'fast_tunnel'
            : 'tunnel'
          : (result.kind ?? 'belt')
    if (
      result.kind === 'combiner' ||
      result.kind === 'splitter' ||
      result.kind === 'trashcan' ||
      result.kind === 'tunnel'
    ) {
      room.frame = match.toFrame()
      participant.contributions++
      room.actionCount++
      room.lastActorId = user.id
      this.history.event(room, 'machine-remove', user.id, {
        structure,
        refund,
        combiners: match.combiners.length,
        splitters: match.splitters.length,
        trashcans: match.trashcans.length,
        tunnels: match.tunnels.length,
      })
      this.runtime.afterAction(room)
      return { frame: room.frame, wallet, refund }
    }
    const committed = this.commit(room, user, participant, match, 'remove', structure, { refund })
    return { ...committed, wallet, refund }
  }
  join(room: Room, user: User) {
    const match = this.editable(room)
    match.noteCollaborator({ id: user.id, nickname: user.nickname })
    room.frame = match.toFrame()
    this.member(room, user)
    this.runtime.afterAction(room)
    return { frame: room.frame }
  }
  advance(room: Room, user: User) {
    if (!(user.roles ?? []).includes('admin'))
      fail(403, 'Apenas administradores podem avançar a versão.')
    const match = this.editable(room)
    const from = match.version
    forceAdvance(match)
    room.frame = match.toFrame()
    this.history.event(room, 'version-advance', user.id, { from, to: match.version })
    this.runtime.afterAction(room)
    return { frame: room.frame }
  }
  buyChunk(room: Room, user: User, participant: Member, body: Record<string, unknown>) {
    const match = this.editable(room)
    const extent = this.rules.pipeline.mapChunkExtent
    const cx = integer(body.cx, 0, extent - 1, 'Chunk X')
    const cy = integer(body.cy, 0, extent - 1, 'Chunk Y')
    const amount = integer(body.amount, 1, this.rules.pipeline.walletCap, 'Moedas')
    settleFundedPledges(match)
    room.frame = match.toFrame()
    const quote = quoteChunkContribution(match, { cx, cy }, amount)
    if (!quote.ok) {
      this.runtime.afterAction(room)
      fail(quote.status, quote.error)
    }
    const wallet = this.wallet.spend(user, amount)
    recordRoomSpend(match, user.id, amount)
    const funded = applyChunkContribution(match, { cx, cy }, user.id, amount)
    room.frame = match.toFrame()
    participant.contributions++
    room.actionCount++
    room.lastActorId = user.id
    this.history.event(room, 'chunk-fund', user.id, {
      cx,
      cy,
      amount,
      paid: funded.paid,
      cost: funded.cost,
    })
    if (funded.completed) {
      this.history.event(room, 'chunk-buy', user.id, { cx, cy, cost: funded.cost })
    }
    this.runtime.afterAction(room)
    return {
      frame: room.frame,
      wallet,
      cost: funded.cost,
      paid: funded.paid,
      amount,
      completed: funded.completed,
    }
  }
  buyCore(room: Room, user: User, participant: Member, body: Record<string, unknown>) {
    const match = this.editable(room)
    const extent = this.rules.pipeline.mapChunkExtent
    const cx = integer(body.cx, 0, extent - 1, 'Chunk X')
    const cy = integer(body.cy, 0, extent - 1, 'Chunk Y')
    const amount = integer(body.amount, 1, this.rules.pipeline.walletCap, 'Moedas')
    settleFundedPledges(match)
    settleFundedCorePledges(match)
    room.frame = match.toFrame()
    const quote = quoteCoreContribution(match, { cx, cy }, amount)
    if (!quote.ok) {
      this.runtime.afterAction(room)
      fail(quote.status, quote.error)
    }
    const wallet = this.wallet.spend(user, amount)
    recordRoomSpend(match, user.id, amount)
    const funded = applyCoreContribution(match, { cx, cy }, user.id, amount)
    room.frame = match.toFrame()
    participant.contributions++
    room.actionCount++
    room.lastActorId = user.id
    this.history.event(room, 'core-fund', user.id, {
      cx,
      cy,
      amount,
      paid: funded.paid,
      cost: funded.cost,
    })
    if (funded.completed) {
      this.history.event(room, 'core-buy', user.id, { cx, cy, cost: funded.cost })
    }
    this.runtime.afterAction(room)
    return {
      frame: room.frame,
      wallet,
      cost: funded.cost,
      paid: funded.paid,
      amount,
      completed: funded.completed,
    }
  }
  chat(room: Room, user: User, participant: Member, body: Record<string, unknown>) {
    this.editable(room)
    const now = this.now()
    if (
      this.rules.chatCooldownMs > 0 &&
      participant.lastChatAt != null &&
      now - participant.lastChatAt < this.rules.chatCooldownMs
    )
      fail(429, 'Aguarde um momento antes de enviar outra mensagem.')
    const message: ChatMessage = {
      id: randomUUID(),
      authorId: user.id,
      authorNickname: user.nickname,
      text: text(body.text, 1, this.rules.chatMessageMaxLength, 'Mensagem'),
      createdAt: now,
    }
    room.chat = [...(room.chat ?? []), message].slice(-this.rules.chatHistoryLimit)
    participant.lastChatAt = now
    participant.nickname = user.nickname
    this.runtime.publishChat(room.id, room.chat)
    return { message, chat: room.chat }
  }
  adminRooms() {
    return Object.values(this.store.state.rooms)
      .filter((room) => isPipelineFrame(room.frame))
      .map((room) => ({
        ...this.publicRoom(room),
        chatCount: (room.chat ?? []).length,
        lastChatAt: room.chat?.at(-1)?.createdAt ?? null,
      }))
      .sort((a, b) => (b.lastChatAt ?? 0) - (a.lastChatAt ?? 0))
  }
  adminChat(room: Room) {
    return { room: this.publicRoom(room), chat: room.chat ?? [] }
  }
  deleteChatMessage(room: Room, messageId: string, actorId: string | null) {
    const chat = room.chat ?? []
    const index = chat.findIndex((message) => message.id === messageId)
    if (index < 0) fail(404, 'Mensagem não encontrada.')
    const [removed] = chat.splice(index, 1)
    room.chat = chat
    this.history.event(room, 'chat-delete', actorId, { messageId, authorId: removed?.authorId })
    this.runtime.publishChat(room.id, room.chat)
    return { chat: room.chat }
  }
  clearChat(room: Room, actorId: string | null) {
    const removed = (room.chat ?? []).length
    room.chat = []
    this.history.event(room, 'chat-clear', actorId, { removed })
    this.runtime.publishChat(room.id, room.chat)
    return { chat: room.chat, removed }
  }
  private editable(room: Room) {
    if (!isPipelineFrame(room.frame))
      fail(409, 'Esta sala é de uma versão anterior.')
    return Match.fromFrame(room.frame, this.rules.pipeline)
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
  private pay(user: User, amount: number) {
    if (amount <= 0) return this.wallet.read(user)
    return this.wallet.spend(user, amount)
  }
  private refund(user: User, amount: number) {
    if (amount <= 0) return this.wallet.read(user)
    return this.wallet.credit(user, amount)
  }
  /** Spend then credit so a mixed stroke can charge some cells and refund others. */
  private settle(user: User, cost: number, refund: number) {
    this.pay(user, cost)
    return this.refund(user, refund)
  }
  private commitMachine(
    room: Room,
    user: User,
    participant: Member,
    match: Match,
    structure: string,
    cost = 0,
    refund = 0,
  ) {
    room.frame = match.toFrame()
    participant.contributions++
    room.actionCount++
    room.lastActorId = user.id
    this.history.event(room, 'machine-place', user.id, {
      structure,
      cost,
      refund,
      combiners: match.combiners.length,
      splitters: match.splitters.length,
      trashcans: match.trashcans.length,
      tunnels: match.tunnels.length,
    })
    this.runtime.afterAction(room)
    return { frame: room.frame }
  }
  private commit(
    room: Room,
    user: User,
    participant: Member,
    match: Match,
    eventType: string,
    structure: 'belt' | 'fast_belt' | 'fast_tunnel' | 'tunnel' | 'splitter' | 'combiner' = 'belt',
    detail: Record<string, unknown> = {},
  ) {
    room.frame = match.toFrame()
    participant.contributions++
    room.actionCount++
    room.lastActorId = user.id
    room.beltCount = room.frame.belts.length
    if (
      room.eligibilityMode === 'automatic' &&
      participant.contributions >= room.minContributions
    )
      participant.eligible = true
    this.history.event(room, eventType, user.id, {
      structure,
      belts: room.beltCount,
      ...detail,
    })
    this.runtime.afterAction(room)
    return { frame: room.frame }
  }
  eligibility(
    room: Room,
    user: User,
    targetId: string,
    body: Record<string, unknown>,
  ) {
    if (user.id !== room.creatorId || room.eligibilityMode !== 'manual')
      fail(403, 'Apenas o BDFL pode habilitar manualmente.')
    const target = room.members[targetId]
    if (!target || !target.contributions)
      fail(400, 'Escolha um contribuidor da sala.')
    if (typeof body.eligible !== 'boolean') fail(400, 'Habilitação inválida.')
    target.eligible = body.eligible
    this.history.event(room, 'eligibility', user.id, {
      targetId: target.id,
      eligible: target.eligible,
    })
    return { ok: true }
  }
}