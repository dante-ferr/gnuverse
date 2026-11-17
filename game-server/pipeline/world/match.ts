import { cellKey } from '../geometry/cell.ts'
import type { Cell } from '../geometry/cell.ts'
import type { Direction } from '../geometry/direction.ts'
import { BeltMachine } from '../machines/belt-machine.ts'
import { CoreMachine } from '../machines/core-machine.ts'
import { SourceMachine } from '../machines/source-machine.ts'
import { Packet } from '../packets/packet.ts'
import type { PipelineRules } from '../rules.ts'
import { layoutInitialMachines } from './map-layout.ts'
import { BeltEditor } from './belt-editor.ts'
import { Emission } from './emission.ts'
import type { PacketShape } from '../packets/packet.ts'
import { coreAcceptsShape, coreDemands } from './demands.ts'
import type { CollaboratorRecord, PipelineFrame } from './frame.ts'
import { Movement } from './movement.ts'

/** One Open Pipeline match. The server tick is the only writer. */
export class Match {
  belts: BeltMachine[] = []
  packets: Packet[] = []
  collaborators: CollaboratorRecord[] = []
  tickIndex = 0
  deliveries = 0
  deliveryByShape: Partial<Record<PacketShape, number>> = {}
  nextPacketId = 1
  nextBeltSeq = 1
  readonly rules: PipelineRules
  readonly seed: string
  readonly width: number
  readonly height: number
  readonly source: SourceMachine
  readonly core: CoreMachine

  constructor(
    rules: PipelineRules,
    seed: string,
    width: number,
    height: number,
    source: SourceMachine,
    core: CoreMachine,
  ) {
    this.rules = rules
    this.seed = seed
    this.width = width
    this.height = height
    this.source = source
    this.core = core
  }

  static create(seed: string, rules: PipelineRules) {
    const { coreOrigin, sourceOrigin, sourceDirection } = layoutInitialMachines(rules, seed)
    return new Match(
      rules,
      seed,
      rules.gridWidth,
      rules.gridHeight,
      new SourceMachine('source', sourceOrigin, sourceDirection, 'circle', rules.sourcePeriodTicks),
      new CoreMachine('core', coreOrigin),
    )
  }

  inBounds(cell: Cell) {
    return cell.x >= 0 && cell.y >= 0 && cell.x < this.width && cell.y < this.height
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
    return coreAcceptsShape(this.rules, '0.1', shape, this.deliveryByShape)
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
  }

  toFrame(): PipelineFrame {
    return {
      kind: 'pipeline',
      version: '0.1',
      seed: this.seed,
      width: this.width,
      height: this.height,
      tick: this.tickIndex,
      deliveries: this.deliveries,
      deliveryByShape: { ...this.deliveryByShape },
      demands: coreDemands(this.rules, '0.1', this.deliveryByShape),
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
      source: {
        id: this.source.id,
        x: this.source.origin.x,
        y: this.source.origin.y,
        direction: this.source.direction,
        shape: this.source.shape,
        cooldown: this.source.ticksUntilEmit,
      },
      core: { id: this.core.id, x: this.core.origin.x, y: this.core.origin.y },
    }
  }

  static fromFrame(frame: PipelineFrame, rules: PipelineRules) {
    const match = new Match(
      rules,
      frame.seed,
      frame.width,
      frame.height,
      new SourceMachine(
        frame.source.id,
        { x: frame.source.x, y: frame.source.y },
        frame.source.direction,
        frame.source.shape,
        rules.sourcePeriodTicks,
        frame.source.cooldown,
      ),
      new CoreMachine(frame.core.id, { x: frame.core.x, y: frame.core.y }),
    )
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
    return match
  }
}