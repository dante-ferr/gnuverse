import { cellKey } from '../../../../../game-server/pipeline/geometry/cell.ts'
import type { Direction } from '../../../../../game-server/pipeline/geometry/direction.ts'
import { CombinerMachine } from '../../../../../game-server/pipeline/machines/combiner-machine.ts'
import { CoreMachine } from '../../../../../game-server/pipeline/machines/core-machine.ts'
import { SourceMachine } from '../../../../../game-server/pipeline/machines/source-machine.ts'
import { tunnelPairGeometry } from '../../../../../game-server/pipeline/machines/tunnel-machine.ts'
import {
  portAcceptsTunnelExit,
  portFeedsTunnelEntrance,
  type PortSlot,
} from '../../../../../game-server/pipeline/world/edit/building-slots.ts'
import type { PipelineFrame } from '../model/frame.ts'
import type { StrokeCell } from './belt-stroke.ts'

export type PlannedTunnel = {
  entranceX: number
  entranceY: number
  exitX: number
  exitY: number
  facing: Direction
}

export type BeltCrossPlan = {
  belts: StrokeCell[]
  tunnels: PlannedTunnel[]
}

export type BeltOccupancy = {
  conveyors: ReadonlySet<string>
  blocked: ReadonlySet<string>
}

const EMPTY_OCCUPANCY: BeltOccupancy = { conveyors: new Set(), blocked: new Set() }

export type BeltCrossQuery = {
  maxGap: () => number
  occupancy: () => BeltOccupancy
  /** Live belts for owned-belt clears before a tunnel portal. */
  belts?: () => readonly { x: number; y: number; direction: Direction; authorId?: string }[]
  /** Machine ports that can feed an entrance or accept an exit without a spacer belt. */
  ports?: () => readonly PortSlot[]
}

let beltCrossQuery: BeltCrossQuery = {
  maxGap: () => 8,
  occupancy: () => EMPTY_OCCUPANCY,
  belts: () => [],
}

export function setBeltCrossQuery(next: BeltCrossQuery) {
  beltCrossQuery = next
}

export function resetBeltCrossQuery() {
  beltCrossQuery = {
    maxGap: () => 8,
    occupancy: () => EMPTY_OCCUPANCY,
    belts: () => [],
  }
}

export function readBeltCrossQuery() {
  return beltCrossQuery
}

/** Cells a new belt or tunnel portal cannot occupy. Conveyors are separate. */
export function occupancyFromFrame(frame: PipelineFrame | null): BeltOccupancy {
  const conveyors = new Set<string>()
  const blocked = new Set<string>()
  if (!frame) return { conveyors, blocked }
  for (const belt of frame.belts) conveyors.add(cellKey(belt))

  const block = (x: number, y: number, width: number, height: number) => {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        blocked.add(cellKey({ x: x + dx, y: y + dy }))
      }
    }
  }

  const cores = frame.cores?.length ? frame.cores : [frame.core]
  for (const core of cores) block(core.x, core.y, CoreMachine.size, CoreMachine.size)
  const sources = frame.sources?.length ? frame.sources : [frame.source]
  for (const source of sources) block(source.x, source.y, SourceMachine.size, SourceMachine.size)
  for (const machine of frame.combiners ?? []) {
    const size = CombinerMachine.sizeFor(machine.machineId, machine.facing)
    block(machine.x, machine.y, size.width, size.height)
  }
  for (const splitter of frame.splitters ?? []) block(splitter.x, splitter.y, 1, 1)
  for (const portal of frame.tunnels ?? []) block(portal.x, portal.y, 1, 1)
  return { conveyors, blocked }
}

/**
 * Replace crossings with tunnel pairs when a belt stroke overlaps existing belts.
 * A run thicker than `maxGap`, or a run with no free portal cell, is left
 * alone: those cells are omitted and no tunnel is emitted.
 */
export function planBeltCrossings(
  cells: readonly StrokeCell[],
  conveyors: ReadonlySet<string>,
  blocked: ReadonlySet<string>,
  maxGap: number,
  ports: readonly PortSlot[] = [],
): BeltCrossPlan {
  if (maxGap < 0 || cells.length === 0) return { belts: [...cells], tunnels: [] }
  const omit = new Set<number>()
  const tunnels: PlannedTunnel[] = []
  for (const [start, end] of legRanges(cells)) {
    const leg = cells.slice(start, end)
    const local = planLeg(leg, conveyors, blocked, maxGap, ports)
    for (const index of local.omit) omit.add(start + index)
    tunnels.push(...local.tunnels)
  }
  return {
    belts: cells.filter((_, index) => !omit.has(index)),
    tunnels,
  }
}

function legRanges(cells: readonly StrokeCell[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  let start = 0
  for (let i = 1; i <= cells.length; i++) {
    if (i === cells.length || cells[i]!.direction !== cells[i - 1]!.direction) {
      ranges.push([start, i])
      start = i
    }
  }
  return ranges
}

function planLeg(
  leg: readonly StrokeCell[],
  conveyors: ReadonlySet<string>,
  blocked: ReadonlySet<string>,
  maxGap: number,
  ports: readonly PortSlot[],
): { omit: number[]; tunnels: PlannedTunnel[] } {
  const omit: number[] = []
  const tunnels: PlannedTunnel[] = []
  const kindOf = (index: number) => kind(leg[index]!, conveyors, blocked)
  const free = (index: number) => index >= 0 && index < leg.length && kindOf(index) === 'free'

  let index = 0
  while (index < leg.length) {
    if (free(index)) {
      index += 1
      continue
    }
    const runEnd = endOfSolid(leg, index, conveyors, blocked)
    const cover = coverCluster(leg, index, conveyors, blocked, maxGap, ports)
    if (cover) {
      for (let cursor = cover.entrance; cursor <= cover.exit; cursor++) omit.push(cursor)
      const entrance = leg[cover.entrance]!
      const exit = leg[cover.exit]!
      tunnels.push({
        entranceX: entrance.x,
        entranceY: entrance.y,
        exitX: exit.x,
        exitY: exit.y,
        facing: entrance.direction,
      })
      index = cover.exit + 1
      continue
    }
    for (let cursor = index; cursor < runEnd; cursor++) omit.push(cursor)
    index = runEnd
  }
  return { omit, tunnels }
}

/**
 * Tunnel from the free cell before `start` through following solid runs.
 * Merges runs while the pair stays within `maxGap` (few tunnels), then places
 * the exit on the first free cell after that cover (short span).
 */
function coverCluster(
  leg: readonly StrokeCell[],
  start: number,
  conveyors: ReadonlySet<string>,
  blocked: ReadonlySet<string>,
  maxGap: number,
  ports: readonly PortSlot[],
): { entrance: number; exit: number } | null {
  const entrance = start - 1
  // Lead-in belt, stroke starting on an empty entrance (adjacent to the crossed
  // line), or a machine output plugged into the entrance. An existing belt at
  // index 0 (redirect origin treated as free) is not an adjacent start.
  if (entrance < 0 || kind(leg[entrance]!, conveyors, blocked) !== 'free') return null
  const portal = leg[entrance]!
  const backedByBelt = entrance >= 1 && kind(leg[entrance - 1]!, conveyors, blocked) === 'free'
  const backedByStrokeStart =
    entrance === 0 && !existingBeltAt(portal.x, portal.y)
  const backedByPort = portFeedsTunnelEntrance(ports, portal, portal.direction)
  if (!backedByBelt && !backedByStrokeStart && !backedByPort) return null

  const hasConveyorInSpan = (exitIndex: number) => {
    const lo = Math.min(start, exitIndex)
    const hi = Math.max(start, exitIndex)
    for (let index = lo; index <= hi; index++) {
      if (kind(leg[index]!, conveyors, blocked) === 'conveyor') return true
    }
    return false
  }

  const validExit = (exitIndex: number) => {
    if (exitIndex < 0 || exitIndex >= leg.length) return false
    if (kind(leg[exitIndex]!, conveyors, blocked) !== 'free') return false
    if (!hasConveyorInSpan(exitIndex)) return false
    if (!outputClear(leg, exitIndex, conveyors, blocked, ports)) return false
    const exit = leg[exitIndex]!
    return tunnelPairGeometry(portal, exit, portal.direction, maxGap).ok
  }

  // Grow through later solid runs while a short exit after the merged cover fits.
  // Intermediate solid ends may not be valid exits (next cell is more solid).
  let solidStart = start
  let lastValidExit: number | null = null
  while (solidStart < leg.length) {
    let solidEnd = solidStart
    while (solidEnd < leg.length && kind(leg[solidEnd]!, conveyors, blocked) !== 'free') {
      solidEnd += 1
    }
    if (solidEnd >= leg.length) break
    if (validExit(solidEnd)) lastValidExit = solidEnd

    let nextSolid = solidEnd + 1
    while (nextSolid < leg.length && kind(leg[nextSolid]!, conveyors, blocked) === 'free') {
      nextSolid += 1
    }
    if (nextSolid >= leg.length) break

    let peekEnd = nextSolid
    while (peekEnd < leg.length && kind(leg[peekEnd]!, conveyors, blocked) !== 'free') {
      peekEnd += 1
    }
    if (peekEnd >= leg.length) break
    // Merge only when the short exit after the next run is still a legal pair.
    if (!validExit(peekEnd)) break
    solidStart = nextSolid
  }

  if (lastValidExit === null) return null
  return { entrance, exit: lastValidExit }
}

/**
 * A belt after the exit, the stroke ending on the exit against the crossed
 * solid (adjacent end), or an input whose approach is that exit.
 */
function outputClear(
  leg: readonly StrokeCell[],
  exitIndex: number,
  conveyors: ReadonlySet<string>,
  blocked: ReadonlySet<string>,
  ports: readonly PortSlot[],
) {
  const next = exitIndex + 1
  if (next < leg.length && kind(leg[next]!, conveyors, blocked) === 'free') return true
  if (
    next >= leg.length &&
    exitIndex > 0 &&
    kind(leg[exitIndex - 1]!, conveyors, blocked) !== 'free'
  ) {
    return true
  }
  const exit = leg[exitIndex]!
  return portAcceptsTunnelExit(ports, exit, exit.direction)
}

function existingBeltAt(x: number, y: number) {
  const belts = readBeltCrossQuery().belts?.() ?? []
  return belts.some((belt) => belt.x === x && belt.y === y)
}

function endOfSolid(
  leg: readonly StrokeCell[],
  start: number,
  conveyors: ReadonlySet<string>,
  blocked: ReadonlySet<string>,
) {
  let index = start
  while (index < leg.length && kind(leg[index]!, conveyors, blocked) !== 'free') index += 1
  return index
}

function kind(
  cell: StrokeCell,
  conveyors: ReadonlySet<string>,
  blocked: ReadonlySet<string>,
): 'conveyor' | 'blocked' | 'free' {
  const key = cellKey(cell)
  if (conveyors.has(key)) return 'conveyor'
  if (blocked.has(key)) return 'blocked'
  return 'free'
}
