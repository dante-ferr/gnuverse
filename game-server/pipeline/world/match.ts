import { cellKey } from '../geometry/cell.ts'
import type { Cell } from '../geometry/cell.ts'
import type { Direction } from '../geometry/direction.ts'
import { BeltMachine } from '../machines/belt-machine.ts'
import { CombinerMachine } from '../machines/combiner-machine.ts'
import { CoreMachine } from '../machines/core-machine.ts'
import { SourceMachine } from '../machines/source-machine.ts'
import { SplitterMachine } from '../machines/splitter-machine.ts'
import { TunnelPortalMachine } from '../machines/tunnel-machine.ts'
import { Packet } from '../packets/packet.ts'
import { sourcePeriodTicksForRole } from '../elements/rate.ts'
import type { PipelineRules } from '../rules.ts'
import { cellChunkStateFromSets, chunkKeySet } from './chunks/coords.ts'
import type { ChunkCoord } from './chunks/coords.ts'
import { layoutMatchFromSeed, machinesFromLayout } from './chunks/match-layout.ts'
import { layoutSandboxFromSeed, sandboxMachinesFromLayout } from './chunks/sandbox-layout.ts'
import { BeltEditor } from './edit/belt-editor.ts'
import { MachineEditor, type MachinePlaceRequest } from './edit/machine-editor.ts'
import { Craft } from './tick/craft.ts'
import { Emission } from './tick/emission.ts'
import { Routing } from './tick/routing.ts'
import type { PacketShape } from '../packets/packet.ts'
import { coreAcceptsShape, coreDemands } from './progression/demands.ts'
import type { CollaboratorRecord, PipelineFrame, SourceRecord } from './frame.ts'
import type { SourceRole } from './types.ts'
import { Movement } from './tick/movement.ts'
import { tryAutoUnlock } from './progression/unlock.ts'

/** One Open Pipeline match. The server tick is the only writer. */
export class Match {
  belts: BeltMachine[] = []
  packets: Packet[] = []
  collaborators: CollaboratorRecord[] = []
  /** Destination cell key → last inbound cell key admitted by merge RR. */
  mergeLast: Record<string, string> = {}
  /** Approach cell key → last winner between input pull and belt flow. */
  pullLast: Record<string, 'pull' | 'flow'> = {}
  version = '0.1'
  tickIndex = 0
  deliveries = 0
  deliveryByShape: Partial<Record<PacketShape, number>> = {}
  /** Core id → tick index of last successful intake. */
  coreLastIntakeTick: Record<string, number> = {}
  nextPacketId = 1
  nextBeltSeq = 1
  nextCombinerSeq = 1
  nextSplitterSeq = 1
  nextTunnelSeq = 1
  readonly rules: PipelineRules
  readonly seed: string
  readonly sandbox: boolean
  width: number
  height: number
  originChunk: ChunkCoord
  readonly ownedChunks: ChunkCoord[]
  readonly previewChunks: ChunkCoord[]
  readonly sources: SourceMachine[]
  readonly sourceRoles: Record<string, SourceRole>
  readonly cores: CoreMachine[]
  combiners: CombinerMachine[] = []
  splitters: SplitterMachine[] = []
  tunnels: TunnelPortalMachine[] = []
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
    const { core, sources, roles } = machinesFromLayout(rules, layout)
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
      [core],
      false,
    )
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
    const key = cellKey(cell)
    return this.belts.find((belt) => cellKey(belt.origin) === key)
  }

  machineAt(cell: Cell) {
    if (this.cores.some((core) => core.covers(cell))) return 'core'
    if (this.sources.some((source) => source.covers(cell))) return 'source'
    if (this.combiners.some((machine) => machine.covers(cell))) return 'combiner'
    if (this.splitters.some((machine) => machine.covers(cell))) return 'splitter'
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

  place(cells: { x: number; y: number; direction: Direction }[], author: CollaboratorRecord) {
    return new BeltEditor(this).place(cells, author)
  }

  /**
   * Removes a belt or player machine under `cell`.
   * Cores and sources cannot be deleted.
   */
  remove(
    cell: Cell,
    author: CollaboratorRecord,
  ): { error: string | null; kind: 'belt' | 'combiner' | 'splitter' | 'tunnel' | null } {
    if (this.cores.some((core) => core.covers(cell))) {
      return { error: 'Não é possível apagar o núcleo.', kind: null }
    }
    if (this.sources.some((source) => source.covers(cell))) {
      return { error: 'Não é possível apagar fontes.', kind: null }
    }
    const machineKind = new MachineEditor(this).removeAt(cell, author)
    if (machineKind) return { error: null, kind: machineKind }
    const error = new BeltEditor(this).remove(cell, author)
    return { error, kind: error ? null : 'belt' }
  }

  placeMachine(spec: MachinePlaceRequest, author: CollaboratorRecord) {
    return new MachineEditor(this).place(spec, author)
  }

  acceptsDelivery(shape: PacketShape) {
    return coreAcceptsShape(this.rules, this.version, shape, this.deliveryByShape, this.sandbox)
  }

  recordDelivery(shape: PacketShape, coreId?: string) {
    if (!this.acceptsDelivery(shape)) return
    this.deliveries += 1
    this.deliveryByShape[shape] = (this.deliveryByShape[shape] ?? 0) + 1
    if (coreId) this.coreLastIntakeTick[coreId] = this.tickIndex
  }

  tick() {
    new Movement(this).resolve()
    new Routing(this).resolve()
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
      demands: coreDemands(this.rules, this.version, this.deliveryByShape, this.sandbox),
      collaborators: this.collaborators.map((person) => ({ ...person })),
      nextPacketId: this.nextPacketId,
      nextBeltSeq: this.nextBeltSeq,
      nextCombinerSeq: this.nextCombinerSeq,
      nextSplitterSeq: this.nextSplitterSeq,
      nextTunnelSeq: this.nextTunnelSeq,
      sandbox: this.sandbox ? true : undefined,
      belts: this.belts.map((belt) => ({
        id: belt.id,
        x: belt.origin.x,
        y: belt.origin.y,
        direction: belt.direction,
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
        authorId: portal.authorId,
        authorNickname: portal.authorNickname,
        queue: portal.role === 'entrance' ? [...portal.queue] : undefined,
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
    match.version = frame.version ?? '0.1'
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
    match.belts = frame.belts.map(
      (belt) =>
        new BeltMachine(belt.id, { x: belt.x, y: belt.y }, belt.direction, {
          id: belt.authorId,
          nickname: belt.authorNickname,
          placedAt: belt.placedAt,
        }),
    )
    match.packets = frame.packets.map(
      (packet) => new Packet(packet.id, { x: packet.x, y: packet.y }, packet.shape),
    )
    match.mergeLast = frame.mergeLast ? { ...frame.mergeLast } : {}
    match.pullLast = frame.pullLast ? { ...frame.pullLast } : {}
    match.combiners = (frame.combiners ?? []).map(
      (spec) => {
        const machine = new CombinerMachine(
          spec.id,
          spec.machineId,
          { x: spec.x, y: spec.y },
          spec.facing,
        )
        machine.activeRecipeId = spec.recipeId ?? null
        machine.buffer = { ...spec.buffer }
        machine.craftRemaining = spec.craftRemaining
        machine.pendingOutputs = spec.pendingOutputs ? [...spec.pendingOutputs] : null
        machine.nextSplitPort = spec.nextSplitPort
        return machine
      },
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
      )
      if (spec.role === 'entrance' && spec.queue) {
        portal.queue = [...spec.queue]
      }
      return portal
    })
    return match
  }
}