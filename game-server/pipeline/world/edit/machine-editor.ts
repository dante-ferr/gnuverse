import { cellKey } from '../../geometry/cell.ts'
import { isDirection, type Direction } from '../../geometry/direction.ts'
import { CombinerMachine, type CombinerMachineId } from '../../machines/combiner-machine.ts'
import { SplitterMachine } from '../../machines/splitter-machine.ts'
import {
  TunnelPortalMachine,
  tunnelPairGeometry,
} from '../../machines/tunnel-machine.ts'
import {
  matchBuildingMachines,
  portsOverlapBuildings,
  type BuildingFootprint,
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

/** Places and removes player machines (combiners sandbox-only; splitter/tunnel everywhere). */
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
    if (!this.match.sandbox) return null
    const [removed] = this.match.combiners.splice(index, 1)
    if (removed) {
      this.match.packets = this.match.packets.filter((packet) => !removed.covers(packet.cell))
    }
    this.match.noteCollaborator(author)
    return 'combiner'
  }

  private placeCombiner(spec: CombinerPlaceRequest, author: Author) {
    if (!this.match.sandbox) return 'Combinadores só estão disponíveis na sala teste.'
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
    if (!isDirection(spec.facing)) return 'Direção inválida.'
    if (!this.footprintInOwned(spec.x, spec.y, 1, 1)) return 'Fora da área liberada.'
    if (this.overlapsMachines(spec.x, spec.y, 1, 1)) {
      return 'Espaço ocupado por outra estrutura.'
    }
    if (this.overlapsBelts(spec.x, spec.y, 1, 1)) return 'Há esteiras nesse espaço.'
    const probe = new SplitterMachine(
      'probe',
      { x: spec.x, y: spec.y },
      spec.facing,
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
    const id = `s${this.match.nextSplitterSeq++}`
    this.match.splitters.push(
      new SplitterMachine(id, { x: spec.x, y: spec.y }, spec.facing, {
        id: author.id,
        nickname: author.nickname,
      }),
    )
    this.match.noteCollaborator(author)
    return null
  }

  private placeTunnel(spec: TunnelPlaceRequest, author: Author) {
    if (!isDirection(spec.facing)) return 'Direção inválida.'
    const entrance = { x: spec.entranceX, y: spec.entranceY }
    const exit = { x: spec.exitX, y: spec.exitY }
    const geometry = tunnelPairGeometry(
      entrance,
      exit,
      spec.facing,
      this.match.rules.tunnelMaxGap,
    )
    if (!geometry.ok) return geometry.reason
    if (!this.footprintInOwned(entrance.x, entrance.y, 1, 1)) return 'Fora da área liberada.'
    if (!this.footprintInOwned(exit.x, exit.y, 1, 1)) return 'Fora da área liberada.'
    if (this.overlapsMachines(entrance.x, entrance.y, 1, 1) || this.overlapsMachines(exit.x, exit.y, 1, 1)) {
      return 'Espaço ocupado por outra estrutura.'
    }
    if (this.overlapsBelts(entrance.x, entrance.y, 1, 1) || this.overlapsBelts(exit.x, exit.y, 1, 1)) {
      return 'Há esteiras nesse espaço.'
    }
    const probeIn = new TunnelPortalMachine(
      'probe:in',
      entrance,
      'entrance',
      'probe',
      spec.facing,
      author,
      geometry.gap,
    )
    const probeOut = new TunnelPortalMachine(
      'probe:out',
      exit,
      'exit',
      'probe',
      spec.facing,
      author,
      0,
    )
    const tunnelSlots = [...probeIn.slots, ...probeOut.slots]
    const footprints: BuildingFootprint[] = [
      { origin: entrance, width: 1, height: 1 },
      { origin: exit, width: 1, height: 1 },
    ]
    if (this.portsOverlapBuildings(tunnelSlots, footprints, { proposedIsLogistic: true })) {
      return 'Entradas ou saídas sobrepõem outra estrutura.'
    }
    const pairId = `t${this.match.nextTunnelSeq++}`
    this.match.tunnels.push(
      new TunnelPortalMachine(
        `${pairId}:in`,
        entrance,
        'entrance',
        pairId,
        spec.facing,
        { id: author.id, nickname: author.nickname },
        geometry.gap,
      ),
      new TunnelPortalMachine(
        `${pairId}:out`,
        exit,
        'exit',
        pairId,
        spec.facing,
        { id: author.id, nickname: author.nickname },
        0,
      ),
    )
    this.match.packets = this.match.packets.filter(
      (packet) =>
        cellKey(packet.cell) !== cellKey(entrance) && cellKey(packet.cell) !== cellKey(exit),
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

  private portsOverlapBuildings(
    slots: readonly { cell: { x: number; y: number }; role: 'input' | 'output'; travel: Direction }[],
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
}
