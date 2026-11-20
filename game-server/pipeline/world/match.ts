import { cellKey } from '../geometry/cell.ts'
import type { Cell } from '../geometry/cell.ts'
import type { Direction } from '../geometry/direction.ts'
import { BeltMachine } from '../machines/belt-machine.ts'
import { CombinerMachine } from '../machines/combiner-machine.ts'
import { CoreMachine } from '../machines/core-machine.ts'
import { SourceMachine } from '../machines/source-machine.ts'
import { SplitterMachine } from '../machines/splitter-machine.ts'
import { TrashcanMachine } from '../machines/trashcan-machine.ts'
import { TunnelPortalMachine } from '../machines/tunnel-machine.ts'
import { Packet } from '../packets/packet.ts'
import { sourcePeriodTicksForRole } from '../elements/rate.ts'
import type { PipelineRules } from '../rules.ts'
import { cellChunkStateFromSets, chunkKeySet } from './chunks/coords.ts'
import type { ChunkCoord } from './chunks/coords.ts'
import { layoutMatchFromSeed, machinesFromLayout } from './chunks/match-layout.ts'
import { layoutSandboxFromSeed, sandboxMachinesFromLayout } from './chunks/sandbox-layout.ts'
import { beltListPrice } from '../../economy/prices.ts'
import { BeltEditor } from './edit/belt-editor.ts'
import { MachineEditor, type MachinePlaceRequest } from './edit/machine-editor.ts'
import { Craft } from './tick/craft.ts'
import { Emission } from './tick/emission.ts'
import { Routing } from './tick/routing.ts'
import type { PacketShape } from '../packets/packet.ts'
import type {
  ChunkPledgeRecord,
  CollaboratorRecord,
  PipelineFrame,
  SourceRecord,
} from './frame.ts'
import type { SourceRole } from './types.ts'
import { deliveryScore } from './progression/score.ts'
import { Movement } from './tick/movement.ts'
import {
  chapterFromVersion,
  chapterToVersion,
  coreAcceptsShape,
  coreDemands,
  matchDemandProgress,
} from './progression/demands.ts'
import { tryAutoUnlock } from './progression/unlock.ts'

/** One Open Pipeline match. The server tick is the only writer. */
export class Match {
  belts: BeltMachine[] = []
  /** Rebuilt when `belts` is replaced. Tick movement looks belts up by cell. */
  private beltIndex: Map<string, BeltMachine> | null = null
  private beltIndexSource: BeltMachine[] | null = null
  packets: Packet[] = []
  collaborators: CollaboratorRecord[] = []
  /** Destination cell key → last inbound cell key admitted by merge RR. */
  mergeLast: Record<string, string> = {}
  /** Approach cell key → last winner between input pull and belt flow. */
  pullLast: Record<string, 'pull' | 'flow'> = {}
  version = '0.1'
  chapter = 1
  /** Room clears completed (sidebar Onda). Crafts use per-shape waves below. */
  escalationWave = 0
  /** Per-shape craft escalation wave; unset shapes stay at base quota. */
  escalationWaveByShape: Partial<Record<PacketShape, number>> = {}
  tickIndex = 0
  deliveries = 0
  deliveryByShape: Partial<Record<PacketShape, number>> = {}
  /** Fresh craft-wave deliveries (reset on each clear). Bases use lifetime only. */
  waveDeliveryByShape: Partial<Record<PacketShape, number>> = {}
  /** Core id → tick index of last successful intake. */
  coreLastIntakeTick: Record<string, number> = {}
  nextPacketId = 1
  nextBeltSeq = 1
  nextCombinerSeq = 1
  nextSplitterSeq = 1
  nextTunnelSeq = 1
  nextTrashcanSeq = 1
  readonly rules: PipelineRules
  readonly seed: string
  readonly sandbox: boolean
  width: number
  height: number
  originChunk: ChunkCoord
  readonly ownedChunks: ChunkCoord[]
  readonly previewChunks: ChunkCoord[]
  sources: SourceMachine[]
  sourceRoles: Record<string, SourceRole>
  cores: CoreMachine[]
  grassChunkKey: string | null = null
  /** World `"cx,cy"` keys reserved for satellite cores (discovered on preview). */
  satelliteChunkKeys: Set<string> = new Set()
  generatedChunkKeys: Set<string>
  combiners: CombinerMachine[] = []
  splitters: SplitterMachine[] = []
  trashcans: TrashcanMachine[] = []
  tunnels: TunnelPortalMachine[] = []
  chunkPledges: ChunkPledgeRecord[] = []
  private ownedChunkKeys: Set<string>
  private previewChunkKeys: Set<string>

  constructor(
    rules: PipelineRules,
    seed: string,
    width: number,
    height: number,
    originChunk: ChunkCoord,
    ownedChunks: ChunkCoord[],
    previewChunks: ChunkCoord[],
    sources: SourceMachine[],
    sourceRoles: Record<string, SourceRole>,
    cores: CoreMachine[],
    sandbox = false,
    grassChunkKey: string | null = null,
    generatedChunkKeys: Iterable<string> = [],
    satelliteChunkKeys: Iterable<string> = [],
  ) {
    this.rules = rules
    this.seed = seed
    this.sandbox = sandbox
    this.width = width
    this.height = height
    this.originChunk = originChunk
    this.ownedChunks = ownedChunks
    this.previewChunks = previewChunks
    this.sources = sources
    this.sourceRoles = sourceRoles
    this.cores = cores
    this.grassChunkKey = grassChunkKey
    this.generatedChunkKeys = new Set(generatedChunkKeys)
    this.satelliteChunkKeys = new Set(satelliteChunkKeys)
    this.ownedChunkKeys = chunkKeySet(ownedChunks)
    this.previewChunkKeys = chunkKeySet(previewChunks)
  }

  get core(): CoreMachine {
    return this.cores[0]!
  }

  /** @deprecated Use `sources`; kept for transitional call sites. */
  get source(): SourceMachine {
    return this.sources[0]!
  }

  static create(seed: string, rules: PipelineRules) {
    const layout = layoutMatchFromSeed(rules, seed)
    const { cores, sources, roles } = machinesFromLayout(rules, layout)
    const match = new Match(
      rules,
      seed,
      layout.width,
      layout.height,
      layout.originChunk,
      layout.ownedChunks,
      layout.previewChunks,
      sources,
      roles,
      cores,
      false,
      layout.grassChunkKey,
      layout.generatedChunkKeys,
      layout.satelliteChunkKeys,
    )
    match.chapter = 1
    match.version = chapterToVersion(1)
    return match
  }

  static createSandbox(seed: string, rules: PipelineRules) {
    const layout = layoutSandboxFromSeed(rules, seed)
    const { cores, sources, roles } = sandboxMachinesFromLayout(rules, layout)
    return new Match(
      rules,
      seed,
      layout.width,
      layout.height,
      layout.originChunk,
      layout.ownedChunks,
      layout.previewChunks,
      sources,
      roles,
      cores,
      true,
    )
  }

  inBounds(cell: Cell) {
    return cell.x >= 0 && cell.y >= 0 && cell.x < this.width && cell.y < this.height
  }

  isOwnedCell(cell: Cell) {
    return (
      cellChunkStateFromSets(
        cell,
        this.ownedChunkKeys,
        this.previewChunkKeys,
        this.originChunk,
        this.rules.chunkSize,
      ) === 'owned'
    )
  }

  inPlayableBounds(cell: Cell) {
    return this.inBounds(cell) && this.isOwnedCell(cell)
  }

  /** Refresh membership sets after owned/preview arrays change (chunk purchase). */
  rebuildChunkKeys() {
    this.ownedChunkKeys = chunkKeySet(this.ownedChunks)
    this.previewChunkKeys = chunkKeySet(this.previewChunks)
  }

  sourceEmitsInPlay(source: SourceMachine) {
    return this.isOwnedCell(source.origin)
  }

  beltAt(cell: Cell) {
    if (this.beltIndexSource !== this.belts || !this.beltIndex) {
      const index = new Map<string, BeltMachine>()
      for (const belt of this.belts) index.set(cellKey(belt.origin), belt)
      this.beltIndex = index
      this.beltIndexSource = this.belts
    }
    return this.beltIndex.get(cellKey(cell))
  }

  machineAt(cell: Cell) {
    if (this.cores.some((core) => core.covers(cell))) return 'core'
    if (this.sources.some((source) => source.covers(cell))) return 'source'
    if (this.combiners.some((machine) => machine.covers(cell))) return 'combiner'
    if (this.splitters.some((machine) => machine.covers(cell))) return 'splitter'
    if (this.trashcans.some((machine) => machine.covers(cell))) return 'trashcan'
    if (this.tunnels.some((portal) => portal.covers(cell))) return 'tunnel'
    return null
  }

  combinerAt(cell: Cell) {
    return this.combiners.find((machine) => machine.covers(cell))
  }

  noteCollaborator(author: CollaboratorRecord) {
    if (!this.collaborators.some((person) => person.id === author.id))
      this.collaborators.push({ id: author.id, nickname: author.nickname })
  }

  place(
    cells: { x: number; y: number; direction: Direction }[],
    author: CollaboratorRecord,
    speed = 1,
  ) {
    return this.placeBilling(cells, author, speed).error
  }

  placeBilling(
    cells: { x: number; y: number; direction: Direction }[],
    author: CollaboratorRecord,
    speed = 1,
  ) {
    return new BeltEditor(this).placeBilling(cells, author, speed)
  }

  /**
   * Removes a belt or player machine under `cell`.
   * Cores and sources cannot be deleted.
   * `listPrice` is the structure's full price. The caller applies `refund_percent`.
   */
  remove(
    cell: Cell,
    author: CollaboratorRecord,
  ): {
    error: string | null
    kind: 'belt' | 'combiner' | 'splitter' | 'trashcan' | 'tunnel' | null
    authorId: string | null
    listPrice: number
    speed: number
  } {
    const empty = {
      kind: null,
      authorId: null,
      listPrice: 0,
      speed: 1,
    }
    if (this.cores.some((core) => core.covers(cell))) {
      return { ...empty, error: 'Não é possível apagar o núcleo.' }
    }
    if (this.sources.some((source) => source.covers(cell))) {
      return { ...empty, error: 'Não é possível apagar fontes.' }
    }
    const machine = new MachineEditor(this).removeAt(cell, author)
    if (machine) return { error: null, ...machine }
    const belt = this.beltAt(cell)
    const error = new BeltEditor(this).remove(cell, author)
    if (error || !belt) return { ...empty, error }
    return {
      error: null,
      kind: 'belt',
      authorId: belt.authorId,
      listPrice: beltListPrice(this.rules, belt.speed),
      speed: belt.speed,
    }
  }

  placeMachine(spec: MachinePlaceRequest, author: CollaboratorRecord) {
    return this.placeMachineBilling(spec, author).error
  }

  placeMachineBilling(spec: MachinePlaceRequest, author: CollaboratorRecord) {
    return new MachineEditor(this).placeBilling(spec, author)
  }

  acceptsDelivery(shape: PacketShape) {
    return coreAcceptsShape(this.rules, matchDemandProgress(this), shape)
  }

  recordDelivery(shape: PacketShape, coreId?: string) {
    if (!this.acceptsDelivery(shape)) return
    this.deliveries += deliveryScore(this.rules, shape)
    this.deliveryByShape[shape] = (this.deliveryByShape[shape] ?? 0) + 1
    if (!this.sandbox) {
      this.waveDeliveryByShape[shape] = (this.waveDeliveryByShape[shape] ?? 0) + 1
    }
    if (coreId) this.coreLastIntakeTick[coreId] = this.tickIndex
  }

  tick() {
    for (const portal of this.tunnels) {
      if (portal.role === 'entrance') portal.beginTick()
    }
    const maxSpeed = this.rules.beltSpeedFast
    for (let phase = 0; phase < maxSpeed; phase++) {
      new Movement(this).resolve({ phase })
      new Routing(this).resolve({ phase })
    }
    new Craft(this).resolve()
    new Emission(this).emit()
    this.tickIndex += 1
    if (!this.sandbox) tryAutoUnlock(this)
  }

  private sourceRecords(): SourceRecord[] {
    return this.sources.map((machine) => ({
      id: machine.id,
      x: machine.origin.x,
      y: machine.origin.y,
      direction: machine.direction,
      shape: machine.shape,
      role: this.sourceRoles[machine.id] ?? machine.shape,
      cooldown: machine.ticksUntilEmit,
    }))
  }

  toFrame(): PipelineFrame {
    const sources = this.sourceRecords()
    const cores = this.cores.map((machine) => {
      const lastIntakeTick = this.coreLastIntakeTick[machine.id]
      return {
        id: machine.id,
        x: machine.origin.x,
        y: machine.origin.y,
        ...(lastIntakeTick !== undefined ? { lastIntakeTick } : {}),
      }
    })
    return {
      kind: 'pipeline',
      version: this.version,
      seed: this.seed,
      width: this.width,
      height: this.height,
      tick: this.tickIndex,
      deliveries: this.deliveries,
      deliveryByShape: { ...this.deliveryByShape },
      waveDeliveryByShape: { ...this.waveDeliveryByShape },
      chapter: this.chapter,
      escalationWave: this.escalationWave,
      escalationWaveByShape: { ...this.escalationWaveByShape },
      generatedChunkKeys: [...this.generatedChunkKeys],
      satelliteChunkKeys: [...this.satelliteChunkKeys],
      grassChunkKey: this.grassChunkKey ?? undefined,
      demands: coreDemands(this.rules, matchDemandProgress(this)),
      collaborators: this.collaborators.map((person) => ({ ...person })),
      nextPacketId: this.nextPacketId,
      nextBeltSeq: this.nextBeltSeq,
      nextCombinerSeq: this.nextCombinerSeq,
      nextSplitterSeq: this.nextSplitterSeq,
      nextTunnelSeq: this.nextTunnelSeq,
      nextTrashcanSeq: this.nextTrashcanSeq,
      sandbox: this.sandbox ? true : undefined,
      belts: this.belts.map((belt) => ({
        id: belt.id,
        x: belt.origin.x,
        y: belt.origin.y,
        direction: belt.direction,
        speed: belt.speed,
        authorId: belt.authorId,
        authorNickname: belt.authorNickname,
        placedAt: belt.placedAt,
      })),
      packets: this.packets.map((packet) => ({
        id: packet.id,
        x: packet.cell.x,
        y: packet.cell.y,
        shape: packet.shape,
      })),
      mergeLast: { ...this.mergeLast },
      pullLast: { ...this.pullLast },
      originChunk: { ...this.originChunk },
      ownedChunks: this.ownedChunks.map((coord) => ({ ...coord })),
      previewChunks: this.previewChunks.map((coord) => ({ ...coord })),
      chunkPledges: this.chunkPledges.map((pledge) => ({
        cx: pledge.cx,
        cy: pledge.cy,
        paid: pledge.paid,
        backers: pledge.backers.map((backer) => ({ ...backer })),
      })),
      sources,
      source: { ...sources[0]! },
      core: { ...cores[0]! },
      cores,
      combiners: this.combiners.map((machine) => ({
        id: machine.id,
        machineId: machine.machineId,
        recipeId: machine.activeRecipeId,
        x: machine.origin.x,
        y: machine.origin.y,
        facing: machine.facing,
        buffer: { ...machine.buffer },
        craftRemaining: machine.craftRemaining,
        pendingOutputs: machine.pendingOutputs ? [...machine.pendingOutputs] : null,
        nextSplitPort: machine.nextSplitPort,
        authorId: machine.authorId,
        authorNickname: machine.authorNickname,
      })),
      trashcans: this.trashcans.map((machine) => ({
        id: machine.id,
        x: machine.origin.x,
        y: machine.origin.y,
        facing: machine.facing,
        authorId: machine.authorId,
        authorNickname: machine.authorNickname,
      })),
      splitters: this.splitters.map((machine) => ({
        id: machine.id,
        x: machine.origin.x,
        y: machine.origin.y,
        facing: machine.facing,
        authorId: machine.authorId,
        authorNickname: machine.authorNickname,
        nextSplitPort: machine.nextSplitPort,
        buffer: machine.buffer,
      })),
      tunnels: this.tunnels.map((portal) => ({
        id: portal.id,
        pairId: portal.pairId,
        role: portal.role,
        x: portal.origin.x,
        y: portal.origin.y,
        direction: portal.direction,
        speed: portal.speed,
        authorId: portal.authorId,
        authorNickname: portal.authorNickname,
        queue: portal.role === 'entrance' ? [...portal.queue] : undefined,
        transit: portal.role === 'entrance' ? portal.transitShapes() : undefined,
      })),
    }
  }

  static fromFrame(frame: PipelineFrame, rules: PipelineRules) {
    const legacy = !frame.ownedChunks || frame.ownedChunks.length === 0
    const originChunk = frame.originChunk ?? { cx: 0, cy: 0 }
    const ownedChunks = legacy
      ? [{ cx: originChunk.cx, cy: originChunk.cy }]
      : frame.ownedChunks.map((coord) => ({ ...coord }))
    const previewChunks = frame.previewChunks?.map((coord) => ({ ...coord })) ?? []

    const sourceSpecs = frame.sources?.length
      ? frame.sources
      : [{ ...frame.source, role: frame.source.role ?? 'circle' as const }]
    const sourceRoles: Record<string, SourceRole> = {}
    const sources = sourceSpecs.map((spec) => {
      sourceRoles[spec.id] = spec.role ?? spec.shape
      return new SourceMachine(
        spec.id,
        { x: spec.x, y: spec.y },
        spec.direction,
        spec.shape,
        sourcePeriodTicksForRole(
          rules.elements,
          rules.tickMs,
          spec.role ?? spec.shape,
        ),
        spec.cooldown,
      )
    })

    const coreSpecs = frame.cores?.length
      ? frame.cores
      : [frame.core]
    const cores = coreSpecs.map((spec) => new CoreMachine(spec.id, { x: spec.x, y: spec.y }))

    const match = new Match(
      rules,
      frame.seed,
      frame.width,
      frame.height,
      originChunk,
      ownedChunks,
      previewChunks,
      sources,
      sourceRoles,
      cores,
      frame.sandbox === true,
    )
    match.chapter = frame.chapter ?? chapterFromVersion(frame.version ?? '0.1')
    match.version = frame.version ?? chapterToVersion(match.chapter)
    match.escalationWave = frame.escalationWave ?? 0
    match.escalationWaveByShape = frame.escalationWaveByShape
      ? { ...frame.escalationWaveByShape }
      : {}
    match.waveDeliveryByShape = frame.waveDeliveryByShape
      ? { ...frame.waveDeliveryByShape }
      : {}
    match.grassChunkKey = frame.grassChunkKey ?? null
    match.generatedChunkKeys = new Set(frame.generatedChunkKeys ?? [])
    match.satelliteChunkKeys = new Set(frame.satelliteChunkKeys ?? [])
    match.tickIndex = frame.tick
    match.deliveries = frame.deliveries
    match.deliveryByShape = frame.deliveryByShape
      ? { ...frame.deliveryByShape }
      : { circle: frame.deliveries }
    for (const spec of coreSpecs) {
      if (spec.lastIntakeTick !== undefined) {
        match.coreLastIntakeTick[spec.id] = spec.lastIntakeTick
      }
    }
    match.collaborators = frame.collaborators.map((person) => ({ ...person }))
    match.nextPacketId = frame.nextPacketId
    match.nextBeltSeq = frame.nextBeltSeq
    match.nextCombinerSeq = frame.nextCombinerSeq ?? 1
    match.nextSplitterSeq = frame.nextSplitterSeq ?? 1
    match.nextTunnelSeq = frame.nextTunnelSeq ?? 1
    match.nextTrashcanSeq = frame.nextTrashcanSeq ?? 1
    match.belts = frame.belts.map(
      (belt) =>
        new BeltMachine(
          belt.id,
          { x: belt.x, y: belt.y },
          belt.direction,
          {
            id: belt.authorId,
            nickname: belt.authorNickname,
            placedAt: belt.placedAt,
          },
          belt.speed ?? 1,
        ),
    )
    match.packets = frame.packets.map(
      (packet) => new Packet(packet.id, { x: packet.x, y: packet.y }, packet.shape),
    )
    match.mergeLast = frame.mergeLast ? { ...frame.mergeLast } : {}
    match.pullLast = frame.pullLast ? { ...frame.pullLast } : {}
    match.chunkPledges = pledgesFromFrame(frame)
    match.combiners = (frame.combiners ?? []).map(
      (spec) => {
        const machine = new CombinerMachine(
          spec.id,
          spec.machineId,
          { x: spec.x, y: spec.y },
          spec.facing,
          {
            id: spec.authorId ?? '',
            nickname: spec.authorNickname ?? '',
          },
        )
        machine.activeRecipeId = spec.recipeId ?? null
        machine.buffer = { ...spec.buffer }
        machine.craftRemaining = spec.craftRemaining
        machine.pendingOutputs = spec.pendingOutputs ? [...spec.pendingOutputs] : null
        machine.nextSplitPort = spec.nextSplitPort
        return machine
      },
    )
    match.trashcans = (frame.trashcans ?? []).map(
      (spec) =>
        new TrashcanMachine(
          spec.id,
          { x: spec.x, y: spec.y },
          spec.facing,
          {
            id: spec.authorId ?? '',
            nickname: spec.authorNickname ?? '',
          },
        ),
    )
    match.splitters = (frame.splitters ?? []).map((spec) => {
      const machine = new SplitterMachine(
        spec.id,
        { x: spec.x, y: spec.y },
        spec.facing,
        { id: spec.authorId, nickname: spec.authorNickname },
      )
      machine.nextSplitPort = spec.nextSplitPort
      machine.buffer = spec.buffer
      return machine
    })
    match.tunnels = (frame.tunnels ?? []).map((spec) => {
      const capacity = spec.role === 'entrance' ? (spec.queue?.length ?? 0) : 0
      const portal = new TunnelPortalMachine(
        spec.id,
        { x: spec.x, y: spec.y },
        spec.role,
        spec.pairId,
        spec.direction,
        { id: spec.authorId, nickname: spec.authorNickname },
        capacity,
        spec.speed ?? 1,
      )
      if (spec.role === 'entrance' && spec.queue) {
        portal.queue = [...spec.queue]
      }
      return portal
    })
    return match
  }
}

function pledgesFromFrame(frame: PipelineFrame): ChunkPledgeRecord[] {
  const raw = frame.chunkPledges
  if (!Array.isArray(raw)) return []
  const pledges: ChunkPledgeRecord[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const cx = item.cx
    const cy = item.cy
    const paid = item.paid
    if (!Number.isInteger(cx) || !Number.isInteger(cy) || !Number.isInteger(paid) || paid < 0) {
      continue
    }
    const backers = Array.isArray(item.backers)
      ? item.backers.flatMap((backer) => {
          if (!backer || typeof backer !== 'object') return []
          if (typeof backer.userId !== 'string' || !Number.isInteger(backer.amount) || backer.amount < 0) {
            return []
          }
          return [{ userId: backer.userId, amount: backer.amount }]
        })
      : []
    pledges.push({ cx, cy, paid, backers })
  }
  return pledges
}