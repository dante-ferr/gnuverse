import { cellKey, type Cell } from '../../geometry/cell.ts'
import { isDirection, type Direction } from '../../geometry/direction.ts'
import { CombinerMachine, type CombinerMachineId } from '../../machines/combiner-machine.ts'
import { SplitterMachine } from '../../machines/splitter-machine.ts'
import {
  TunnelPortalMachine,
  tunnelPairGeometry,
} from '../../machines/tunnel-machine.ts'
import {
  logisticContactBlocked,
  matchBuildingMachines,
  portsOverlapBuildings,
  type BuildingFootprint,
  type PortSlot,
} from './building-slots.ts'
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

export type TunnelPlaceRequest = {
  machineId: 'tunnel'
  entranceX: number
  entranceY: number
  exitX: number
  exitY: number
  facing: Direction
}

export type MachinePlaceRequest = CombinerPlaceRequest | SplitterPlaceRequest | TunnelPlaceRequest

export type RemoveKind = 'combiner' | 'splitter' | 'tunnel' | null

/** Places and removes player machines (combiner, splitter, tunnel). */
export class MachineEditor {
  private match: Match

  constructor(match: Match) {
    this.match = match
  }

  place(spec: MachinePlaceRequest, author: Author) {
    if (spec.machineId === 'tunnel') return this.placeTunnel(spec, author)
    if (spec.machineId === 'splitter') return this.placeSplitter(spec, author)
    return this.placeCombiner(spec, author)
  }

  /** Removes a player machine under `cell`. Returns which kind, or null. */
  removeAt(cell: { x: number; y: number }, author: Author): RemoveKind {
    const splitterIndex = this.match.splitters.findIndex((machine) => machine.covers(cell))
    if (splitterIndex >= 0) {
      const [removed] = this.match.splitters.splice(splitterIndex, 1)
      if (removed) {
        this.match.packets = this.match.packets.filter((packet) => !removed.covers(packet.cell))
      }
      this.match.noteCollaborator(author)
      return 'splitter'
    }

    const tunnel = this.match.tunnels.find((portal) => portal.covers(cell))
    if (tunnel) {
      const pairId = tunnel.pairId
      this.match.tunnels = this.match.tunnels.filter((portal) => portal.pairId !== pairId)
      this.match.noteCollaborator(author)
      return 'tunnel'
    }

    const index = this.match.combiners.findIndex((machine) => machine.covers(cell))
    if (index < 0) return null
    const [removed] = this.match.combiners.splice(index, 1)
    if (removed) {
      this.match.packets = this.match.packets.filter((packet) => !removed.covers(packet.cell))
    }
    this.match.noteCollaborator(author)
    return 'combiner'
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
      new CombinerMachine(id, spec.machineId, { x: spec.x, y: spec.y }, spec.facing),
    )
    this.match.noteCollaborator(author)
    return null
  }

  private placeSplitter(spec: SplitterPlaceRequest, author: Author) {
    const cell = { x: spec.x, y: spec.y }
    const foreign = this.foreignBeltAt(cell, author)
    if (foreign) return foreign
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

  private placeTunnel(spec: TunnelPlaceRequest, author: Author) {
    const entrance = { x: spec.entranceX, y: spec.entranceY }
    const exit = { x: spec.exitX, y: spec.exitY }
    const facing =
      this.match.beltAt(entrance)?.direction ??
      this.match.beltAt(exit)?.direction ??
      spec.facing
    if (!isDirection(facing)) return 'Direção inválida.'
    const geometry = tunnelPairGeometry(
      entrance,
      exit,
      facing,
      this.match.rules.tunnelMaxGap,
    )
    if (!geometry.ok) return geometry.reason
    if (!this.footprintInOwned(entrance.x, entrance.y, 1, 1)) return 'Fora da área liberada.'
    if (!this.footprintInOwned(exit.x, exit.y, 1, 1)) return 'Fora da área liberada.'
    if (this.overlapsMachines(entrance.x, entrance.y, 1, 1) || this.overlapsMachines(exit.x, exit.y, 1, 1)) {
      return 'Espaço ocupado por outra estrutura.'
    }
    const portals = [entrance, exit]
    const beltError = this.assertReplaceableBelts(portals, author)
    if (beltError) return beltError
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
    const contactError = this.logisticContactBlocked(tunnelSlots, footprints, 'tunnel')
    if (contactError) return contactError
    if (
      this.portsOverlapBuildings(tunnelSlots, footprints, {
        linkedTunnelSlots: tunnelSlots,
      })
    ) {
      return 'Entradas ou saídas sobrepõem outra estrutura.'
    }
    // Gap belts stay on the surface. Only the portal cells are replaced.
    this.clearBeltsAt(portals)
    const pairId = `t${this.match.nextTunnelSeq++}`
    this.match.tunnels.push(
      new TunnelPortalMachine(
        `${pairId}:in`,
        entrance,
        'entrance',
        pairId,
        facing,
        { id: author.id, nickname: author.nickname },
        geometry.gap,
      ),
      new TunnelPortalMachine(
        `${pairId}:out`,
        exit,
        'exit',
        pairId,
        facing,
        { id: author.id, nickname: author.nickname },
        0,
      ),
    )
    this.match.noteCollaborator(author)
    return null
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

  private foreignBeltAt(cell: Cell, author: Author): string | null {
    const belt = this.match.beltAt(cell)
    if (!belt) return null
    if (belt.authorId !== author.id) return 'Essa esteira é de outra pessoa.'
    return null
  }

  private assertReplaceableBelts(cells: readonly Cell[], author: Author): string | null {
    for (const cell of cells) {
      const error = this.foreignBeltAt(cell, author)
      if (error) return error
    }
    return null
  }

  private clearBeltAt(cell: Cell) {
    const key = cellKey(cell)
    this.match.belts = this.match.belts.filter((item) => cellKey(item.origin) !== key)
    this.match.packets = this.match.packets.filter((packet) => cellKey(packet.cell) !== key)
  }

  private clearBeltsAt(cells: readonly Cell[]) {
    const keys = new Set(cells.map(cellKey))
    this.match.belts = this.match.belts.filter((belt) => !keys.has(cellKey(belt.origin)))
    this.match.packets = this.match.packets.filter((packet) => !keys.has(cellKey(packet.cell)))
  }

  private portsOverlapBuildings(
    slots: readonly PortSlot[],
    footprints: readonly BuildingFootprint[],
    options?: { proposedIsLogistic?: boolean; linkedTunnelSlots?: readonly PortSlot[] },
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
