import type { Cell } from './cell.ts'
import { opposite, type Direction } from './direction.ts'
import type { Machine } from '../machines/machine.ts'

export type SideDepths = { north: number; east: number; south: number; west: number }

/** Inclusive cell bounds of the machine footprint plus clearance margins. */
export type FreeRect = { x0: number; y0: number; x1: number; y1: number }

const sides: readonly Direction[] = ['north', 'east', 'south', 'west']

function emptySides(): SideDepths {
  return { north: 0, east: 0, south: 0, west: 0 }
}

/** Counts I/O slots on each face (not clearance depths). */
export function portCountsBySide(machine: Machine): SideDepths {
  const counts = emptySides()
  for (const slot of machine.slots) {
    const side: Direction =
      slot.role === 'input' ? opposite(slot.travel) : slot.travel
    counts[side] += 1
  }
  return counts
}

export function clearanceDepths(
  ports: SideDepths,
  minClearance: number,
  extraAllSides = 0,
): SideDepths {
  const depths = emptySides()
  for (const side of sides) {
    depths[side] = Math.max(minClearance, ports[side]) + extraAllSides
  }
  return depths
}

export function freeRect(
  origin: Cell,
  width: number,
  height: number,
  depths: SideDepths,
): FreeRect {
  return {
    x0: origin.x - depths.west,
    y0: origin.y - depths.north,
    x1: origin.x + width - 1 + depths.east,
    y1: origin.y + height - 1 + depths.south,
  }
}

export function rectsOverlap(a: FreeRect, b: FreeRect): boolean {
  return a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1
}

export function assertNonOverlappingFreeAreas(rects: FreeRect[]): void {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i]!, rects[j]!))
        throw new Error(
          `Machine free areas overlap: (${rects[i]!.x0},${rects[i]!.y0})–(${rects[i]!.x1},${rects[i]!.y1}) and (${rects[j]!.x0},${rects[j]!.y0})–(${rects[j]!.x1},${rects[j]!.y1})`,
        )
    }
  }
}