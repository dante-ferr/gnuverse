import type { Cell } from '../../geometry/cell.ts'
import { cellKey, sameCell } from '../../geometry/cell.ts'
import { ahead, directions, opposite, type Direction } from '../../geometry/direction.ts'
import type { Machine } from '../../machines/machine.ts'
import type { Match } from '../match.ts'

export type BuildingFootprint = {
  origin: Cell
  width: number
  height: number
}

export type PortSlot = {
  cell: Cell
  role: 'input' | 'output'
  travel: Direction
}

export function buildingBodyKeySet(machines: Iterable<Machine>): Set<string> {
  const keys = new Set<string>()
  for (const machine of machines) {
    for (let dy = 0; dy < machine.height; dy++) {
      for (let dx = 0; dx < machine.width; dx++) {
        keys.add(cellKey({ x: machine.origin.x + dx, y: machine.origin.y + dy }))
      }
    }
  }
  return keys
}

export function footprintBodyKeySet(footprints: readonly BuildingFootprint[]): Set<string> {
  const keys = new Set<string>()
  for (const fp of footprints) {
    for (let dy = 0; dy < fp.height; dy++) {
      for (let dx = 0; dx < fp.width; dx++) {
        keys.add(cellKey({ x: fp.origin.x + dx, y: fp.origin.y + dy }))
      }
    }
  }
  return keys
}

export function matchBuildingMachines(match: Match): Machine[] {
  return [
    ...match.cores,
    ...match.sources,
    ...match.combiners,
    ...match.splitters,
    ...match.tunnels,
  ]
}

export function isLogisticMachine(machine: { kind: string }): boolean {
  return machine.kind === 'splitter' || machine.kind === 'tunnel'
}

export type PortsOverlapOptions = {
  proposedIsLogistic?: boolean
  /** Port occupancy may sit on a machine this tunnel is linked to. */
  linkedTunnelSlots?: readonly PortSlot[]
}

/**
 * Cell a port claims against other buildings: outputs use the exterior slot
 * cell; inputs use the approach cell one step outside (where the bracket opens).
 */
export function portOccupancyCell(slot: PortSlot): Cell {
  if (slot.role === 'output') return slot.cell
  return ahead(slot.cell.x, slot.cell.y, opposite(slot.travel))
}

/**
 * True when a proposed port’s occupancy cell lies on another building body, or
 * an existing port’s occupancy cell lies on a proposed footprint. Port cells may
 * share a tile with each other; adjacency alone is allowed.
 */
export function portsOverlapBuildings(
  proposedSlots: readonly PortSlot[],
  proposedFootprints: readonly BuildingFootprint[],
  existingMachines: readonly Machine[],
  options: PortsOverlapOptions = {},
): boolean {
  const proposedIsLogistic = options.proposedIsLogistic === true
  const linked = options.linkedTunnelSlots
  const existingBodies = buildingBodyKeySet(existingMachines)
  if (!proposedIsLogistic) {
    for (const slot of proposedSlots) {
      const occ = portOccupancyCell(slot)
      if (!existingBodies.has(cellKey(occ))) continue
      if (linked && bodyLinksTunnel(existingMachines, occ, linked)) continue
      return true
    }
  }
  const proposedBodies = footprintBodyKeySet(proposedFootprints)
  for (const machine of existingMachines) {
    if (isLogisticMachine(machine)) continue
    if (linked && machineLinksTunnel(machine.slots, linked)) continue
    for (const slot of machine.slots) {
      if (!proposedBodies.has(cellKey(portOccupancyCell(slot)))) continue
      const plugged =
        proposedIsLogistic &&
        proposedSlots.some((proposed) => portsConnected(proposed, slot))
      if (!plugged) return true
    }
  }
  return false
}

function bodyLinksTunnel(
  machines: readonly Machine[],
  cell: Cell,
  tunnelSlots: readonly PortSlot[],
) {
  for (const machine of machines) {
    if (
      cell.x < machine.origin.x ||
      cell.y < machine.origin.y ||
      cell.x >= machine.origin.x + machine.width ||
      cell.y >= machine.origin.y + machine.height
    ) {
      continue
    }
    if (machineLinksTunnel(machine.slots, tunnelSlots)) return true
  }
  return false
}

export const TUNNEL_CONTACT_ERROR = 'Túneis não podem ficar em contato com outras estruturas.'
export const SPLITTER_COMPAT_PORT_ERROR = 'Sem porta compatível em contato.'

function machineBodyKeys(machine: Machine): Set<string> {
  const keys = new Set<string>()
  for (let dy = 0; dy < machine.height; dy++) {
    for (let dx = 0; dx < machine.width; dx++) {
      keys.add(cellKey({ x: machine.origin.x + dx, y: machine.origin.y + dy }))
    }
  }
  return keys
}

function bodySetsOrthogonallyAdjacent(a: Set<string>, b: Set<string>): boolean {
  for (const key of a) {
    const [xs, ys] = key.split(',')
    const x = Number(xs)
    const y = Number(ys)
    for (const travel of directions) {
      const neighbor = ahead(x, y, travel)
      if (b.has(cellKey(neighbor))) return true
    }
  }
  return false
}

/**
 * True when proposed and existing footprints share an orthogonal edge (body–body only).
 */
export function machinesBodyAdjacent(proposedBodyKeys: Set<string>, existing: Machine): boolean {
  return bodySetsOrthogonallyAdjacent(proposedBodyKeys, machineBodyKeys(existing))
}

/**
 * Direct plug: output cell sits on the input slot and travel matches (flow into
 * the machine). A shared empty approach cell is a belt, not a link. Side/corner
 * contact onto an input tile from the wrong direction does not connect.
 */
export function portsConnected(a: PortSlot, b: PortSlot): boolean {
  if (a.role === b.role) return false
  const output = a.role === 'output' ? a : b
  const input = a.role === 'input' ? a : b
  return sameCell(portOccupancyCell(output), input.cell) && output.travel === input.travel
}

/** Output port sits on the tunnel entrance or on the cell directly behind it. */
export function portFeedsTunnelEntrance(
  ports: readonly PortSlot[],
  entrance: Cell,
  facing: Direction,
): boolean {
  const behind = ahead(entrance.x, entrance.y, opposite(facing))
  return ports.some(
    (slot) =>
      slot.role === 'output' &&
      (sameCell(slot.cell, entrance) || sameCell(slot.cell, behind)),
  )
}

/** Input approach is the tunnel exit or the cell the exit ejects onto. */
export function portAcceptsTunnelExit(
  ports: readonly PortSlot[],
  exit: Cell,
  facing: Direction,
): boolean {
  const ejected = ahead(exit.x, exit.y, facing)
  return ports.some((slot) => {
    if (slot.role !== 'input') return false
    const approach = portOccupancyCell(slot)
    return sameCell(approach, exit) || sameCell(approach, ejected) || sameCell(slot.cell, ejected)
  })
}

export function machineLinksTunnel(
  machineSlots: readonly PortSlot[],
  tunnelSlots: readonly PortSlot[],
) {
  for (const slot of tunnelSlots) {
    const origin =
      slot.role === 'input'
        ? slot.cell
        : ahead(slot.cell.x, slot.cell.y, opposite(slot.travel))
    if (slot.role === 'input' && portFeedsTunnelEntrance(machineSlots, origin, slot.travel)) {
      return true
    }
    if (slot.role === 'output' && portAcceptsTunnelExit(machineSlots, origin, slot.travel)) {
      return true
    }
  }
  return false
}

export type LogisticContactMode = 'splitter' | 'tunnel'

/**
 * Rejects logistic placement when footprint/port contact rules fail.
 * Splitters may touch another building only with a compatible port pair in contact.
 * Tunnels may touch another building only when that machine feeds the entrance
 * or accepts the exit.
 */
export function logisticContactBlocked(
  proposedSlots: readonly PortSlot[],
  proposedFootprints: readonly BuildingFootprint[],
  existingMachines: readonly Machine[],
  mode: LogisticContactMode,
): string | null {
  const proposedBody = footprintBodyKeySet(proposedFootprints)
  if (mode === 'tunnel') {
    for (const machine of existingMachines) {
      if (!machinesBodyAdjacent(proposedBody, machine)) continue
      if (!machineLinksTunnel(machine.slots, proposedSlots)) return TUNNEL_CONTACT_ERROR
    }
    return null
  }
  for (const machine of existingMachines) {
    if (!machinesBodyAdjacent(proposedBody, machine)) continue
    let connected = false
    outer: for (const proposed of proposedSlots) {
      for (const existing of machine.slots) {
        if (portsConnected(proposed, existing)) {
          connected = true
          break outer
        }
      }
    }
    if (!connected) return SPLITTER_COMPAT_PORT_ERROR
  }
  return null
}
