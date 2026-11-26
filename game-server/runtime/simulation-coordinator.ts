import type { ServerResponse } from 'node:http'
import type { ChatMessage, Room } from '../domain/types.ts'
import { fail } from '../domain/validation.ts'
import type { PipelineRules } from '../pipeline/rules.ts'
import { isPipelineFrame, type PipelineFrame } from '../pipeline/world/frame.ts'
import { Match } from '../pipeline/world/match.ts'
import { GameStore } from '../persistence/game-store.ts'
import type { GovernanceService } from '../governance/governance-service.ts'
import { RoomPresence, type PresenceCell } from './room-presence.ts'

/** Steps every pipeline match and fans the frame out over SSE. */
export class SimulationCoordinator {
  private store: GameStore
  private rules: PipelineRules
  private governance?: GovernanceService
  private streams = new Map<string, Set<ServerResponse>>()
  private timer?: ReturnType<typeof setInterval>
  /** Live match reused across ticks until an edit replaces `room.frame`. */
  private live = new Map<string, { match: Match; source: PipelineFrame }>()
  /** Belt geometry already sent on this room's SSE stream. Later ticks omit the belt array. */
  private beltStamps = new Map<string, number>()
  private lastPersistAt = 0
  private presence = new RoomPresence()

  constructor(store: GameStore, rules: PipelineRules) {
    this.store = store
    this.rules = { ...rules }
  }

  publicFrame(room: Room) {
    if (!isPipelineFrame(room.frame))
      fail(409, 'Esta sala é de uma versão anterior.')
    return room.frame
  }

  rollback() {}

  afterAction(room: Room) {
    this.publishChange(room.id)
  }

  publishChange(roomId: string) {
    for (const response of this.streams.get(roomId) ?? [])
      if (response.writableLength < 1024 * 1024)
        response.write('event: change\ndata: {}\n\n')
  }

  publishChat(roomId: string, chat: ChatMessage[]) {
    const payload = `event: chat\ndata: ${JSON.stringify({ chat })}\n\n`
    for (const response of this.streams.get(roomId) ?? [])
      if (response.writableLength < 1024 * 1024) response.write(payload)
  }

  publishPresence(roomId: string) {
    const payload = `event: presence\ndata: ${JSON.stringify({ players: this.presence.snapshot(roomId) })}\n\n`
    for (const response of this.streams.get(roomId) ?? [])
      if (response.writableLength < 1024 * 1024) response.write(payload)
  }

  /** Heartbeat from a signed-in player who has the room open. */
  touchPresence(roomId: string, user: { id: string; nickname: string }) {
    if (this.presence.touch(roomId, user)) this.publishPresence(roomId)
  }

  noteEdit(roomId: string, user: { id: string; nickname: string }, cell: PresenceCell) {
    this.presence.noteEdit(roomId, user, cell)
    this.publishPresence(roomId)
  }

  publishAllChanges(): void {
    for (const roomId of Object.keys(this.store.state.rooms))
      this.publishChange(roomId)
  }

  setPipelineRules(rules: PipelineRules): void {
    const previousTick = this.rules.tickMs
    // Copy so in-place Object.assign on the shared rules.pipeline is visible only after this call.
    this.rules = { ...rules }
    this.live.clear()
    if (rules.tickMs !== previousTick && this.timer && this.governance) {
      clearInterval(this.timer)
      this.timer = undefined
      this.start(this.governance)
    }
  }

  remove(roomId: string) {
    for (const response of this.streams.get(roomId) ?? []) response.end()
    this.streams.delete(roomId)
    this.presence.clear(roomId)
    this.live.delete(roomId)
    this.beltStamps.delete(roomId)
  }

  subscribe(room: Room, response: ServerResponse) {
    if ((this.streams.get(room.id)?.size ?? 0) >= 100)
      fail(503, 'Muitos espectadores.')
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    this.beltStamps.set(room.id, beltLayoutStamp(room.frame.belts))
    response.write(
      `event: frame\ndata: ${JSON.stringify(this.publicFrame(room))}\n\n`,
    )
    response.write(
      `event: chat\ndata: ${JSON.stringify({ chat: room.chat ?? [] })}\n\n`,
    )
    if (!this.streams.has(room.id)) this.streams.set(room.id, new Set())
    response.write(
      `event: presence\ndata: ${JSON.stringify({ players: this.presence.snapshot(room.id) })}\n\n`,
    )
    this.streams.get(room.id)!.add(response)
    response.on('close', () => this.streams.get(room.id)?.delete(response))
  }

  private step() {
    let needsSave = false
    for (const room of Object.values(this.store.state.rooms)) {
      if (!isPipelineFrame(room.frame)) continue
      let live = this.live.get(room.id)
      if (!live || live.source !== room.frame) {
        live = { match: Match.fromFrame(room.frame, this.rules), source: room.frame }
        this.live.set(room.id, live)
      }
      live.match.tick()
      room.frame = live.match.toFrame()
      room.beltCount = room.frame.belts.length
      live.source = room.frame
      needsSave = true
    }
    return needsSave
  }

  start(governance: GovernanceService) {
    this.governance = governance
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => {
      try {
        const needsSave = this.step()
        for (const roomId of this.presence.sweep()) this.publishPresence(roomId)
        for (const room of Object.values(this.store.state.rooms))
          governance.expireBans(room)
        for (const room of Object.values(this.store.state.rooms)) {
          if (!isPipelineFrame(room.frame)) continue
          const viewers = this.streams.get(room.id)
          // Nobody is watching: skip serializing. `subscribe` re-sends the full frame.
          if (!viewers?.size) continue
          const payload = JSON.stringify(this.wireFrame(room.id, room.frame))
          for (const response of viewers) {
            if (response.writableLength > 256 * 1024) continue
            response.write(`event: frame\ndata: ${payload}\n\n`)
          }
        }
        // Placements already persist in `atomic`. Tick snapshots can lag by a second.
        const now = Date.now()
        if (needsSave && now - this.lastPersistAt >= 1000) {
          this.lastPersistAt = now
          this.store.persist()
        }
      } catch (error) {
        console.error('Game simulation failed:', error)
      }
    }, this.rules.tickMs)
    this.timer.unref()
  }

  private wireFrame(roomId: string, frame: PipelineFrame) {
    // Merge/pull round-robin cursors are server-only and can dwarf the rest of a tick frame.
    const { mergeLast: _merge, pullLast: _pull, ...visible } = frame
    const stamp = beltLayoutStamp(frame.belts)
    if (this.beltStamps.get(roomId) !== stamp) {
      this.beltStamps.set(roomId, stamp)
      return visible
    }
    const { belts: _belts, ...rest } = visible
    return { ...rest, omitBelts: true, beltCount: frame.belts.length }
  }

  close() {
    clearInterval(this.timer)
    for (const clients of this.streams.values())
      for (const response of clients) response.end()
  }
}

function beltLayoutStamp(belts: PipelineFrame['belts']) {
  let h = belts.length
  for (const belt of belts) {
    h = Math.imul(h, 33) ^ belt.x
    h = Math.imul(h, 33) ^ belt.y
    h = Math.imul(h, 33) ^ belt.direction.charCodeAt(0)
    h = Math.imul(h, 33) ^ (belt.speed ?? 1)
  }
  return h >>> 0
}
