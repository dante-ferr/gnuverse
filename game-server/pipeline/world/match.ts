import { cellKey } from '../geometry/cell.ts'
import type { Cell } from '../geometry/cell.ts'
import type { Direction } from '../geometry/direction.ts'
import { BeltMachine } from '../machines/belt-machine.ts'
import { CoreMachine } from '../machines/core-machine.ts'
import { SourceMachine } from '../machines/source-machine.ts'
import { Packet } from '../packets/packet.ts'
import type { PipelineRules } from '../rules.ts'
import { cellChunkStateFromSets, chunkKeySet } from './chunks/coords.ts'
import type { ChunkCoord } from './chunks/coords.ts'
import { layoutMatchFromSeed, machinesFromLayout } from './chunks/match-layout.ts'
import { BeltEditor } from './edit/belt-editor.ts'
import { Emission } from './tick/emission.ts'
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
  version = '0.1'
  tickIndex = 0
  deliveries = 0
  deliveryByShape: Partial<Record<PacketShape, number>> = {}
  nextPacketId = 1
  nextBeltSeq = 1
  readonly rules: PipelineRules
  readonly seed: string
  readonly width: number
  readonly height: number
  readonly originChunk: ChunkCoord
  readonly ownedChunks: ChunkCoord[]
  readonly previewChunks: ChunkCoord[]
  readonly sources: SourceMachine[]
  readonly sourceRoles: Record<string, SourceRole>
  readonly core: CoreMachine
  private readonly ownedChunkKeys: Set<string>
  private readonly previewChunkKeys: Set<string>

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
    core: CoreMachine,
  ) {
    this.rules = rules
    this.seed = seed
    this.width = width
    this.height = height
    this.originChunk = originChunk
    this.ownedChunks = ownedChunks
    this.previewChunks = previewChunks
    this.sources = sources
    this.sourceRoles = sourceRoles
    this.core = core
    this.ownedChunkKeys = chunkKeySet(ownedChunks)
    this.previewChunkKeys = chunkKeySet(previewChunks)
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
      core,
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

  sourceEmitsInPlay(source: SourceMachine) {
    return this.isOwnedCell(source.origin)
  }

  beltAt(cell: Cell) {
    const key = cellKey(cell)
    return this.belts.find((belt) => cellKey(belt.origin) === key)
  }

  noteCollaborator(author: CollaboratorRecord) {
    if (!this.collaborators.some((person) => person.id === author.id))
      this.collaborators.push({ id: author.id, nickname: author.nickname })
  }

  place(cells: { x: number; y: number; direction: Direction }[], author: CollaboratorRecord) {
    return new BeltEditor(this).place(cells, author)
  }

  remove(cell: Cell, author: CollaboratorRecord) {
    return new BeltEditor(this).remove(cell, author)
  }

  acceptsDelivery(shape: PacketShape) {
    return coreAcceptsShape(this.rules, this.version, shape, this.deliveryByShape)
  }

  recordDelivery(shape: PacketShape) {
    if (!this.acceptsDelivery(shape)) return
    this.deliveries += 1
    this.deliveryByShape[shape] = (this.deliveryByShape[shape] ?? 0) + 1
  }

  tick() {
    new Movement(this).resolve()
    new Emission(this).emit()
    this.tickIndex += 1
    tryAutoUnlock(this)
  }

  private sourceRecords(): SourceRecord[] {
    return this.sources.map((machine) => ({
      id: machine.id,
      x: machine.origin.x,
      y: machine.origin.y,
      direction: machine.direction,
      shape: machine.shape,
      role: this.sourceRoles[machine.id] ?? 'circle',
      cooldown: machine.ticksUntilEmit,
    }))
  }

  toFrame(): PipelineFrame {
    const sources = this.sourceRecords()
    return {
      kind: 'pipeline',
      version: this.version,
      seed: this.seed,
      width: this.width,
      height: this.height,
      tick: this.tickIndex,
      deliveries: this.deliveries,
      deliveryByShape: { ...this.deliveryByShape },
      demands: coreDemands(this.rules, this.version, this.deliveryByShape),
      collaborators: this.collaborators.map((person) => ({ ...person })),
      nextPacketId: this.nextPacketId,
      nextBeltSeq: this.nextBeltSeq,
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
      originChunk: { ...this.originChunk },
      ownedChunks: this.ownedChunks.map((coord) => ({ ...coord })),
      previewChunks: this.previewChunks.map((coord) => ({ ...coord })),
      sources,
      source: { ...sources[0]! },
      core: { id: this.core.id, x: this.core.origin.x, y: this.core.origin.y },
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
      : [{ ...frame.source, role: 'circle' as const }]
    const sourceRoles: Record<string, SourceRole> = {}
    const sources = sourceSpecs.map((spec) => {
      sourceRoles[spec.id] = spec.role ?? 'circle'
      return new SourceMachine(
        spec.id,
        { x: spec.x, y: spec.y },
        spec.direction,
        spec.shape,
        rules.sourcePeriodTicks,
        spec.cooldown,
      )
    })

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
      new CoreMachine(frame.core.id, { x: frame.core.x, y: frame.core.y }),
    )
    match.version = frame.version ?? '0.1'
    match.tickIndex = frame.tick
    match.deliveries = frame.deliveries
    match.deliveryByShape = frame.deliveryByShape
      ? { ...frame.deliveryByShape }
      : { circle: frame.deliveries }
    match.collaborators = frame.collaborators.map((person) => ({ ...person }))
    match.nextPacketId = frame.nextPacketId
    match.nextBeltSeq = frame.nextBeltSeq
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
    return match
  }
}