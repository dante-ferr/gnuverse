import { cellKey, type Cell } from '../../geometry/cell.ts'
import { isDirection, opposite, type Direction } from '../../geometry/direction.ts'
import { CombinerMachine, type CombinerMachineId } from '../../machines/combiner-machine.ts'
import { SplitterMachine } from '../../machines/splitter-machine.ts'
import { TrashcanMachine } from '../../machines/trashcan-machine.ts'
import {
  TunnelPortalMachine,
  tunnelPairGeometry,
} from '../../machines/tunnel-machine.ts'
import type { PacketShape } from '../../packets/packet.ts'
import {
  logisticContactBlocked,
  matchBuildingMachines,
  portsOverlapBuildings,
  type BuildingFootprint,
  type PortSlot,
} from './building-slots.ts'
import { beltListPrice, structureRefund } from '../../../economy/prices.ts'
import type { Match } from '../match.ts'

type Author = { id: string; nickname: string }

export type CombinerPlaceRequest = {
  machineId: CombinerMachineId
  x: number
  y: number
  facing: Direction
}

export type SplitterPlaceRequest = {
  machineId: 'splitter'
  x: number
  y: number
  facing: Direction
}

export type TrashcanPlaceRequest = {
  machineId: 'trashcan'
  x: number
  y: number
  facing: Direction
}

export type TunnelPlaceRequest = {
  machineId: 'tunnel' | 'fast_tunnel'
  entranceX: number
  entranceY: number
  exitX: number
  exitY: number
  facing: Direction
}

export type MachinePlaceRequest =
  | CombinerPlaceRequest
  | SplitterPlaceRequest
  | TrashcanPlaceRequest
  | TunnelPlaceRequest

export type Removal = {
  kind: 'combiner' | 'splitter' | 'trashcan' | 'tunnel'
  authorId: string
  listPrice: number
  speed: number
}

export type MachinePlaceResult = {
  error: string | null
  /** True for new placements and upgrades (charge list price). */
  billable: boolean
  /** True when an owned fast tunnel is downgraded to normal (`refund_percent` of fast − normal). */
  refund: boolean
  /** Refund for the placer's own belts that this placement overwrote. */
  overwrittenRefund?: number
}

/** Places and removes player machines (combiner, splitter, tunnel). */
export class MachineEditor {
  private match: Match
  private placerId = ''
  private overwrittenRefund = 0

  constructor(match: Match) {
    this.match = match
  }

  place(spec: MachinePlaceRequest, author: Author) {
    return this.placeBilling(spec, author).error
  }

  placeBilling(spec: MachinePlaceRequest, author: Author): MachinePlaceResult {
    this.placerId = author.id
    this.overwrittenRefund = 0
    const result = this.placeBillingInner(spec, author)
    return result.error ? result : { ...result, overwrittenRefund: this.overwrittenRefund }
  }

  private placeBillingInner(spec: MachinePlaceRequest, author: Author): MachinePlaceResult {
    if (spec.machineId === 'tunnel' || spec.machineId === 'fast_tunnel') {
      return this.placeTunnel(spec, author)
    }
    if (spec.machineId === 'splitter') {
      const error = this.placeSplitter(spec, author)
      return { error, billable: error == null, refund: false }
    }
    if (spec.machineId === 'trashcan') {
      const error = this.placeTrashcan(spec, author)
      return { error, billable: error == null, refund: false }
    }
    const error = this.placeCombiner(spec as CombinerPlaceRequest, author)
    return { error, billable: error == null, refund: false }
  }

  /**
   * Re-orients the machine of kind `spec.machineId` covering (`x`, `y`) in place.
   * Free: no charge or refund, and the original author is kept. Tunnels only
   * reverse (entrance and exit swap). Other machines turn around their center.
   */
  rotate(spec: MachinePlaceRequest, cell: Cell, facing: Direction, author: Author): string | null {
    const same = 'Já está nessa direção.'
    const keep = (owner: { authorId: string; authorNickname: string }): Author => ({
      id: owner.authorId,
      nickname: owner.authorNickname,
    })
    if (spec.machineId === 'splitter') {
      const index = this.match.splitters.findIndex((m) => m.covers(cell))
      if (index < 0) return 'Não há divisor nessa célula.'
      const old = this.match.splitters[index]!
      if (old.facing === facing) return same
      this.match.splitters.splice(index, 1)
      const error = this.placeSplitter({ machineId: 'splitter', x: old.origin.x, y: old.origin.y, facing }, keep(old))
      if (error) this.match.splitters.splice(index, 0, old)
      return error
    }
    if (spec.machineId === 'trashcan') {
      const index = this.match.trashcans.findIndex((m) => m.covers(cell))
      if (index < 0) return 'Não há lixeira nessa célula.'
      const old = this.match.trashcans[index]!
      if (old.facing === facing) return same
      this.match.trashcans.splice(index, 1)
      const error = this.placeTrashcan({ machineId: 'trashcan', x: old.origin.x, y: old.origin.y, facing }, keep(old))
      if (error) this.match.trashcans.splice(index, 0, old)
      return error
    }
    if (spec.machineId === 'combiner_2' || spec.machineId === 'combiner_3') {
      const index = this.match.combiners.findIndex(
        (m) => m.covers(cell) && m.machineId === spec.machineId,
      )
      if (index < 0) return 'Não há combinador nessa célula.'
      const old = this.match.combiners[index]!
      if (old.facing === facing) return same
      const next = CombinerMachine.sizeFor(old.machineId, facing)
      const origin = {
        x: old.origin.x + Math.floor((old.width - 1) / 2) - Math.floor((next.width - 1) / 2),
        y: old.origin.y + Math.floor((old.height - 1) / 2) - Math.floor((next.height - 1) / 2),
      }
      this.match.combiners.splice(index, 1)
      const error = this.placeCombiner({ machineId: old.machineId, ...origin, facing }, keep(old))
      if (error) {
        this.match.combiners.splice(index, 0, old)
        return error
      }
      const created = this.match.combiners[this.match.combiners.length - 1]!
      created.buffer = old.buffer
      created.activeRecipeId = old.activeRecipeId
      created.craftRemaining = old.craftRemaining
      created.pendingOutputs = old.pendingOutputs
      created.nextSplitPort = old.nextSplitPort
      return null
    }
    if (spec.machineId === 'tunnel' || spec.machineId === 'fast_tunnel') {
      const hit = this.match.tunnels.find((portal) => portal.covers(cell))
      if (!hit) return 'Não há túnel nessa célula.'
      if (facing !== opposite(hit.direction)) return same
      const pair = this.match.tunnels.filter((portal) => portal.pairId === hit.pairId)
      const entrance = pair.find((portal) => portal.role === 'entrance')
      const exit = pair.find((portal) => portal.role === 'exit')
      if (!entrance || !exit) return 'Túnel inválido.'
      this.match.tunnels = this.match.tunnels.filter((portal) => portal.pairId !== hit.pairId)
      const fast = entrance.speed === this.match.rules.beltSpeedFast
      const result = this.placeTunnel(
        {
          machineId: fast ? 'fast_tunnel' : 'tunnel',
          entranceX: exit.origin.x,
          entranceY: exit.origin.y,
          exitX: entrance.origin.x,
          exitY: entrance.origin.y,
          facing,
        },
        keep(entrance),
      )
      if (result.error) this.match.tunnels.push(...pair)
      return result.error
    }
    return 'Máquina inválida.'
  }

  /** Removes a player machine under `cell`. Returns which kind, or null. */
  removeAt(cell: { x: number; y: number }, author: Author): Removal | null {
    const splitterIndex = this.match.splitters.findIndex((machine) => machine.covers(cell))
    if (splitterIndex >= 0) {
      const removed = this.match.splitters[splitterIndex]!
      const removal: Removal = {
        kind: 'splitter',
        authorId: removed.authorId,
        listPrice: this.match.rules.splitterCost,
        speed: 1,
      }
      this.match.splitters.splice(splitterIndex, 1)
      this.match.packets = this.match.packets.filter((packet) => !removed.covers(packet.cell))
      this.match.noteCollaborator(author)
      return removal
    }

    const tunnel = this.match.tunnels.find((portal) => portal.covers(cell))
    if (tunnel) {
      const fast = tunnel.speed === this.match.rules.beltSpeedFast
      const removal: Removal = {
        kind: 'tunnel',
        authorId: tunnel.authorId,
        listPrice: fast ? this.match.rules.fastTunnelCost : this.match.rules.tunnelCost,
        speed: tunnel.speed,
      }
      const pairId = tunnel.pairId
      this.match.tunnels = this.match.tunnels.filter((portal) => portal.pairId !== pairId)
      this.match.noteCollaborator(author)
      return removal
    }

    const trashcanIndex = this.match.trashcans.findIndex((machine) => machine.covers(cell))
    if (trashcanIndex >= 0) {
      const removed = this.match.trashcans[trashcanIndex]!
      const removal: Removal = {
        kind: 'trashcan',
        authorId: removed.authorId,
        listPrice: this.match.rules.trashcanCost,
        speed: 1,
      }
      this.match.trashcans.splice(trashcanIndex, 1)
      this.match.packets = this.match.packets.filter((packet) => !removed.covers(packet.cell))
      this.match.noteCollaborator(author)
      return removal
    }

    const index = this.match.combiners.findIndex((machine) => machine.covers(cell))
    if (index < 0) return null
    const removed = this.match.combiners[index]!
    const removal: Removal = {
      kind: 'combiner',
      authorId: removed.authorId,
      listPrice: this.match.rules.combinerCost,
      speed: 1,
    }
    this.match.combiners.splice(index, 1)
    this.match.packets = this.match.packets.filter((packet) => !removed.covers(packet.cell))
    this.match.noteCollaborator(author)
    return removal
  }

  private placeTrashcan(spec: TrashcanPlaceRequest, author: Author) {
    const width = TrashcanMachine.width
    const height = TrashcanMachine.height
    if (!this.footprintInOwned(spec.x, spec.y, width, height)) {
      return 'Fora da área liberada.'
    }
    if (this.overlapsMachines(spec.x, spec.y, width, height)) {
      return 'Espaço ocupado por outra estrutura.'
    }
    if (this.overlapsBelts(spec.x, spec.y, width, height)) {
      return 'Há esteiras nesse espaço.'
    }
    const probe = new TrashcanMachine('probe', { x: spec.x, y: spec.y }, spec.facing)
    const footprint: BuildingFootprint = {
      origin: { x: spec.x, y: spec.y },
      width,
      height,
    }
    if (this.portsOverlapBuildings(probe.slots, [footprint])) {
      return 'Entradas ou saídas sobrepõem outra estrutura.'
    }
    const id = `tc${this.match.nextTrashcanSeq++}`
    this.match.trashcans.push(
      new TrashcanMachine(id, { x: spec.x, y: spec.y }, spec.facing, {
        id: author.id,
        nickname: author.nickname,
      }),
    )
    this.match.noteCollaborator(author)
    return null
  }

  private placeCombiner(spec: CombinerPlaceRequest, author: Author) {
    const { width, height } = CombinerMachine.sizeFor(spec.machineId, spec.facing)
    if (!this.footprintInOwned(spec.x, spec.y, width, height)) {
      return 'Fora da área liberada.'
    }
    if (this.overlapsMachines(spec.x, spec.y, width, height)) {
      return 'Espaço ocupado por outra estrutura.'
    }
    if (this.overlapsBelts(spec.x, spec.y, width, height)) {
      return 'Há esteiras nesse espaço.'
    }
    const probe = new CombinerMachine(
      'probe',
      spec.machineId,
      { x: spec.x, y: spec.y },
      spec.facing,
    )
    const footprint: BuildingFootprint = {
      origin: { x: spec.x, y: spec.y },
      width,
      height,
    }
    if (this.portsOverlapBuildings(probe.slots, [footprint])) {
      return 'Entradas ou saídas sobrepõem outra estrutura.'
    }
    const id = `c${this.match.nextCombinerSeq++}`
    this.match.combiners.push(
      new CombinerMachine(id, spec.machineId, { x: spec.x, y: spec.y }, spec.facing, {
        id: author.id,
        nickname: author.nickname,
      }),
    )
    this.match.noteCollaborator(author)
    return null
  }

  private placeSplitter(spec: SplitterPlaceRequest, author: Author) {
    const cell = { x: spec.x, y: spec.y }
    const facing = this.match.beltAt(cell)?.direction ?? spec.facing
    if (!isDirection(facing)) return 'Direção inválida.'
    if (!this.footprintInOwned(spec.x, spec.y, 1, 1)) return 'Fora da área liberada.'
    if (this.overlapsMachines(spec.x, spec.y, 1, 1)) {
      return 'Espaço ocupado por outra estrutura.'
    }
    const probe = new SplitterMachine(
      'probe',
      { x: spec.x, y: spec.y },
      facing,
      author,
    )
    const footprint: BuildingFootprint = {
      origin: { x: spec.x, y: spec.y },
      width: 1,
      height: 1,
    }
    if (this.portsOverlapBuildings(probe.slots, [footprint], { proposedIsLogistic: true })) {
      return 'Entradas ou saídas sobrepõem outra estrutura.'
    }
    const contactError = this.logisticContactBlocked(probe.slots, [footprint], 'splitter')
    if (contactError) return contactError
    this.clearBeltAt(cell)
    const id = `s${this.match.nextSplitterSeq++}`
    this.match.splitters.push(
      new SplitterMachine(id, { x: spec.x, y: spec.y }, facing, {
        id: author.id,
        nickname: author.nickname,
      }),
    )
    this.match.noteCollaborator(author)
    return null
  }

  private placeTunnel(spec: TunnelPlaceRequest, author: Author): MachinePlaceResult {
    const entrance = { x: spec.entranceX, y: spec.entranceY }
    const exit = { x: spec.exitX, y: spec.exitY }
    // Prefer the stroke / client facing so a portal on a perpendicular belt still
    // travels along the planned axis. Fall back to belts on the portal cells.
    const facing = this.resolveTunnelFacing(entrance, exit, spec.facing)
    if (!facing) return { error: 'Direção inválida.', billable: false, refund: false }
    const geometry = tunnelPairGeometry(
      entrance,
      exit,
      facing,
      this.match.rules.tunnelMaxGap,
    )
    if (!geometry.ok) return { error: geometry.reason, billable: false, refund: false }
    if (!this.footprintInOwned(entrance.x, entrance.y, 1, 1)) {
      return { error: 'Fora da área liberada.', billable: false, refund: false }
    }
    if (!this.footprintInOwned(exit.x, exit.y, 1, 1)) {
      return { error: 'Fora da área liberada.', billable: false, refund: false }
    }
    const speed = spec.machineId === 'fast_tunnel' ? this.match.rules.beltSpeedFast : 1
    const replace = this.ownTunnelPairAt(entrance, exit, author)
    if (replace.error) return { error: replace.error, billable: false, refund: false }
    if (!replace.pairId) {
      if (
        this.overlapsMachines(entrance.x, entrance.y, 1, 1) ||
        this.overlapsMachines(exit.x, exit.y, 1, 1)
      ) {
        return { error: 'Espaço ocupado por outra estrutura.', billable: false, refund: false }
      }
    }
    const portals = [entrance, exit]
    const probeIn = new TunnelPortalMachine(
      'probe:in',
      entrance,
      'entrance',
      'probe',
      facing,
      author,
      geometry.gap,
    )
    const probeOut = new TunnelPortalMachine(
      'probe:out',
      exit,
      'exit',
      'probe',
      facing,
      author,
      0,
    )
    const tunnelSlots = [...probeIn.slots, ...probeOut.slots]
    const footprints: BuildingFootprint[] = [
      { origin: entrance, width: 1, height: 1 },
      { origin: exit, width: 1, height: 1 },
    ]
    if (this.portsOverlapBuildings(tunnelSlots, footprints, { proposedIsLogistic: true })) {
      return { error: 'Entradas ou saídas sobrepõem outra estrutura.', billable: false, refund: false }
    }
    let priorSpeed = 0
    let priorAuthorId: string | null = null
    let priorAuthorNickname = ''
    let priorQueue: (PacketShape | null)[] | null = null
    if (replace.pairId) {
      const existing = this.match.tunnels.filter((portal) => portal.pairId === replace.pairId)
      const existingEntrance = existing.find((portal) => portal.role === 'entrance')
      priorSpeed = existingEntrance?.speed ?? existing[0]?.speed ?? 1
      priorAuthorId = existingEntrance?.authorId ?? existing[0]?.authorId ?? null
      priorAuthorNickname = existingEntrance?.authorNickname ?? existing[0]?.authorNickname ?? ''
      priorQueue = existingEntrance ? [...existingEntrance.queue] : null
      this.match.tunnels = this.match.tunnels.filter((portal) => portal.pairId !== replace.pairId)
    }
    // Gap belts stay on the surface. Only the portal cells are replaced.
    this.clearBeltsAt(portals)
    const pairId = replace.pairId ?? `t${this.match.nextTunnelSeq++}`
    // Same-speed replace (e.g. reverse) keeps the builder, so no one can claim a tunnel for free.
    const authorRecord =
      replace.pairId && priorAuthorId !== null && priorSpeed === speed
        ? { id: priorAuthorId, nickname: priorAuthorNickname }
        : { id: author.id, nickname: author.nickname }
    const entrancePortal = new TunnelPortalMachine(
      `${pairId}:in`,
      entrance,
      'entrance',
      pairId,
      facing,
      authorRecord,
      geometry.gap,
      speed,
    )
    if (priorQueue && priorQueue.length === entrancePortal.queue.length) {
      entrancePortal.queue = priorQueue
    }
    this.match.tunnels.push(
      entrancePortal,
      new TunnelPortalMachine(
        `${pairId}:out`,
        exit,
        'exit',
        pairId,
        facing,
        authorRecord,
        0,
        speed,
      ),
    )
    this.match.noteCollaborator(author)
    if (!replace.pairId) return { error: null, billable: true, refund: false }
    if (priorSpeed === speed) return { error: null, billable: false, refund: false }
    const fast = this.match.rules.beltSpeedFast
    if (speed === 1 && priorSpeed === fast) {
      // Only the original author is refunded, so downgrading another player's tunnel earns nothing.
      return { error: null, billable: false, refund: priorAuthorId === author.id }
    }
    return { error: null, billable: true, refund: false }
  }

  /**
   * When both cells are the same owned pair (either portal order), allow replace
   * / speed upgrade. Foreign or mismatched portals return an error.
   */
  private ownTunnelPairAt(
    entrance: Cell,
    exit: Cell,
    author: Author,
  ): { pairId: string | null; error: string | null } {
    const atEntrance = this.match.tunnels.find((portal) => portal.covers(entrance))
    const atExit = this.match.tunnels.find((portal) => portal.covers(exit))
    if (!atEntrance && !atExit) return { pairId: null, error: null }
    if (!atEntrance || !atExit) {
      return { pairId: null, error: 'Espaço ocupado por outra estrutura.' }
    }
    if (atEntrance.pairId !== atExit.pairId) {
      return { pairId: null, error: 'Espaço ocupado por outra estrutura.' }
    }
    const roles = new Set([atEntrance.role, atExit.role])
    if (!roles.has('entrance') || !roles.has('exit')) {
      return { pairId: null, error: 'Espaço ocupado por outra estrutura.' }
    }
    return { pairId: atEntrance.pairId, error: null }
  }

  /** Stroke facing first; portal belts only when that axis is illegal. */
  private resolveTunnelFacing(
    entrance: Cell,
    exit: Cell,
    requested: unknown,
  ): Direction | null {
    const maxGap = this.match.rules.tunnelMaxGap
    const candidates = [
      requested,
      this.match.beltAt(entrance)?.direction,
      this.match.beltAt(exit)?.direction,
    ]
    for (const candidate of candidates) {
      if (!isDirection(candidate)) continue
      if (tunnelPairGeometry(entrance, exit, candidate, maxGap).ok) return candidate
    }
    return isDirection(requested) ? requested : null
  }

  private footprintInOwned(x: number, y: number, width: number, height: number) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        if (!this.match.inPlayableBounds({ x: x + dx, y: y + dy })) return false
      }
    }
    return true
  }

  private overlapsMachines(x: number, y: number, width: number, height: number) {
    const covers = (ox: number, oy: number, w: number, h: number) =>
      x < ox + w && x + width > ox && y < oy + h && y + height > oy
    if (this.match.cores.some((core) => covers(core.origin.x, core.origin.y, core.width, core.height))) {
      return true
    }
    if (this.match.sources.some((source) => covers(source.origin.x, source.origin.y, source.width, source.height))) {
      return true
    }
    if (this.match.combiners.some((machine) => covers(machine.origin.x, machine.origin.y, machine.width, machine.height))) {
      return true
    }
    if (this.match.splitters.some((machine) => covers(machine.origin.x, machine.origin.y, 1, 1))) {
      return true
    }
    if (
      this.match.trashcans.some((machine) =>
        covers(machine.origin.x, machine.origin.y, machine.width, machine.height),
      )
    ) {
      return true
    }
    return this.match.tunnels.some((portal) => covers(portal.origin.x, portal.origin.y, 1, 1))
  }

  private overlapsBelts(x: number, y: number, width: number, height: number) {
    return this.match.belts.some(
      (belt) =>
        belt.origin.x >= x &&
        belt.origin.x < x + width &&
        belt.origin.y >= y &&
        belt.origin.y < y + height,
    )
  }

  /** Overwritten belts of the placer are refunded like a delete. */
  private noteOverwritten(belts: readonly { authorId: string; speed: number }[]) {
    for (const belt of belts) {
      if (belt.authorId !== this.placerId) continue
      this.overwrittenRefund += structureRefund(this.match.rules, beltListPrice(this.match.rules, belt.speed))
    }
  }

  private clearBeltAt(cell: Cell) {
    const key = cellKey(cell)
    this.noteOverwritten(this.match.belts.filter((item) => cellKey(item.origin) === key))
    this.match.belts = this.match.belts.filter((item) => cellKey(item.origin) !== key)
    this.match.packets = this.match.packets.filter((packet) => cellKey(packet.cell) !== key)
  }

  private clearBeltsAt(cells: readonly Cell[]) {
    const keys = new Set(cells.map(cellKey))
    this.noteOverwritten(this.match.belts.filter((belt) => keys.has(cellKey(belt.origin))))
    this.match.belts = this.match.belts.filter((belt) => !keys.has(cellKey(belt.origin)))
    this.match.packets = this.match.packets.filter((packet) => !keys.has(cellKey(packet.cell)))
  }

  private portsOverlapBuildings(
    slots: readonly PortSlot[],
    footprints: readonly BuildingFootprint[],
    options?: { proposedIsLogistic?: boolean },
  ) {
    return portsOverlapBuildings(
      slots,
      footprints,
      matchBuildingMachines(this.match),
      options,
    )
  }

  private logisticContactBlocked(
    slots: readonly PortSlot[],
    footprints: readonly BuildingFootprint[],
    mode: 'splitter' | 'tunnel',
  ) {
    return logisticContactBlocked(slots, footprints, matchBuildingMachines(this.match), mode)
  }
}
