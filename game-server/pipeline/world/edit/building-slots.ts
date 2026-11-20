import type { Cell } from '../../geometry/cell.ts'
import { cellKey } from '../../geometry/cell.ts'
import { ahead, opposite, type Direction } from '../../geometry/direction.ts'
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
): boolean {
  const existingBodies = buildingBodyKeySet(existingMachines)
  for (const slot of proposedSlots) {
    if (existingBodies.has(cellKey(portOccupancyCell(slot)))) return true
  }
  const proposedBodies = footprintBodyKeySet(proposedFootprints)
  for (const machine of existingMachines) {
    for (const slot of machine.slots) {
      if (proposedBodies.has(cellKey(portOccupancyCell(slot)))) return true
    }
  }
  return false
}
