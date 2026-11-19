import { randomUUID } from 'node:crypto'
import type { ChatMessage, Member, Rules, Room, User } from '../domain/types.ts'
import { fail, text, integer, mode } from '../domain/validation.ts'
import { GameStore } from '../persistence/game-store.ts'
import { WalletService } from '../economy/wallet-service.ts'
import { SimulationCoordinator } from '../runtime/simulation-coordinator.ts'
import { HistoryService } from './history-service.ts'
import { isDirection } from '../pipeline/geometry/direction.ts'
import type { CombinerMachineId } from '../pipeline/machines/combiner-machine.ts'
import { Match } from '../pipeline/world/match.ts'
import { isPipelineFrame } from '../pipeline/world/frame.ts'
import { canManageRoom } from '../../core/authz/policy.ts'
import { forceAdvance } from '../pipeline/world/progression/unlock.ts'
import {
  buyPreviewChunk,
  nextChunkCost,
} from '../pipeline/world/chunks/purchase.ts'

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
    const belts = isPipelineFrame(room.frame) ? room.frame.belts.length : 0
    return {
      id: room.id,
      name: room.name,
      creatorId: room.creatorId,
      allowCreatorBan: room.allowCreatorBan === true,
      cost: room.cost,
      eligibilityMode: room.eligibilityMode,
      minContributions: room.minContributions,
      beltCount: belts,
      actionCount: room.actionCount,
      outcome: isPipelineFrame(room.frame) ? 'playing' : 'lost',
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
    if (
      Object.keys(this.store.state.rooms).length >= this.rules.maxRooms ||
      Object.values(this.store.state.rooms).filter(
        (t) => t.creatorId === user.id,
      ).length >= 10
    )
      fail(409, 'Limite de salas atingido.')
    if (
      body.allowCreatorBan !== undefined &&
      typeof body.allowCreatorBan !== 'boolean'
    )
      fail(400, 'A opção de suspensão do criador deve ser booleana.')
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
      allowCreatorBan: room.allowCreatorBan,
      cost: room.cost,
      eligibilityMode: room.eligibilityMode,
      minContributions: room.minContributions,
    })
    this.history.snapshot(room, user.id, 'Sala criada')
    return { room: this.publicRoom(room) }
  }
  settings(room: Room, user: User, body: Record<string, unknown>) {
    if (!canManageRoom({ id: user.id, roles: user.roles ?? [] }, 'update', room.creatorId))
      fail(403, 'Apenas o criador pode alterar as regras.')
    if (Object.hasOwn(body, 'allowCreatorBan'))
      fail(400, 'A opção de suspensão do criador é imutável após criar a sala.')
    if (
      room.proposals.some((proposal) => proposal.status === 'pending')
    )
      fail(409, 'Aguarde a proposta pendente antes de alterar regras.')
    const reason = text(body.reason, 3, 500, 'Justificativa')
    const before = {
      name: room.name,
      cost: room.cost,
      eligibilityMode: room.eligibilityMode,
      minContributions: room.minContributions,
    }
    const after = {
      name: body.name === undefined ? room.name : text(body.name, 3, 60, 'Nome'),
      cost:
        body.cost === undefined
          ? room.cost
          : integer(body.cost, 0, this.rules.maxCost, 'Custo'),
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
    if (machineId !== 'combiner_2' && machineId !== 'combiner_3') {
      fail(400, 'Máquina inválida.')
    }
    if (!isDirection(body.facing)) fail(400, 'Direção inválida.')
    const recipeId = text(body.recipeId, 1, 40, 'Receita')
    const error = match.placeMachine(
      {
        machineId: machineId as CombinerMachineId,
        recipeId,
        x: integer(body.x, 0, match.width - 1, 'X'),
        y: integer(body.y, 0, match.height - 1, 'Y'),
        facing: body.facing,
      },
      { id: user.id, nickname: user.nickname },
    )
    if (error) fail(409, error)
    return this.commitMachine(room, user, participant, match)
  }
  place(room: Room, user: User, participant: Member, body: Record<string, unknown>) {
    const match = this.editable(room)
    const raw = body.cells
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 64)
      fail(400, 'Informe as células da esteira.')
    const cells = raw.map((cell) => this.stroke(cell, match.width, match.height))
    const error = match.place(cells, { id: user.id, nickname: user.nickname })
    if (error) fail(409, error)
    return this.commit(room, user, participant, match, 'place')
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
    if (result.kind === 'combiner') {
      room.frame = match.toFrame()
      participant.contributions++
      room.actionCount++
      room.lastActorId = user.id
      this.history.event(room, 'machine-remove', user.id, {
        combiners: match.combiners.length,
      })
      this.runtime.afterAction(room)
      return { frame: room.frame }
    }
    return this.commit(room, user, participant, match, 'remove')
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
    const cost = nextChunkCost(match)
    const error = buyPreviewChunk(match, { cx, cy })
    if (error) fail(409, error)
    const wallet = this.wallet.spend(user, cost)
    room.frame = match.toFrame()
    participant.contributions++
    room.actionCount++
    room.lastActorId = user.id
    this.history.event(room, 'chunk-buy', user.id, { cx, cy, cost })
    this.runtime.afterAction(room)
    return { frame: room.frame, wallet, cost }
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
  private commitMachine(room: Room, user: User, participant: Member, match: Match) {
    room.frame = match.toFrame()
    participant.contributions++
    room.actionCount++
    room.lastActorId = user.id
    this.history.event(room, 'machine-place', user.id, {
      combiners: match.combiners.length,
    })
    this.runtime.afterAction(room)
    return { frame: room.frame }
  }
  private commit(room: Room, user: User, participant: Member, match: Match, eventType: string) {
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
      structure: 'belt',
      belts: room.beltCount,
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