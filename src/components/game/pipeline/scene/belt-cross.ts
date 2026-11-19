import { cellKey } from '../../../../../game-server/pipeline/geometry/cell.ts'
import type { Direction } from '../../../../../game-server/pipeline/geometry/direction.ts'
import { CombinerMachine } from '../../../../../game-server/pipeline/machines/combiner-machine.ts'
import { CoreMachine } from '../../../../../game-server/pipeline/machines/core-machine.ts'
import { SourceMachine } from '../../../../../game-server/pipeline/machines/source-machine.ts'
import { tunnelPairGeometry } from '../../../../../game-server/pipeline/machines/tunnel-machine.ts'
import type { PipelineFrame } from '../model/frame.ts'
import type { StrokeCell } from './belt-stroke.ts'

/**
 * Free cells required between two belt runs before each run can have its own
 * tunnel: the first exit, one output belt, and the next entrance.
 * One or two empty cells cannot split the runs, so they stay underground.
 */
const TUNNEL_SPLIT_CELLS = 3

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
}

let beltCrossQuery: BeltCrossQuery = {
  maxGap: () => 8,
  occupancy: () => EMPTY_OCCUPANCY,
}

export function setBeltCrossQuery(next: BeltCrossQuery) {
  beltCrossQuery = next
}

export function resetBeltCrossQuery() {
  beltCrossQuery = {
    maxGap: () => 8,
    occupancy: () => EMPTY_OCCUPANCY,
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
): BeltCrossPlan {
  if (maxGap < 1 || cells.length === 0) return { belts: [...cells], tunnels: [] }
  const omit = new Set<number>()
  const tunnels: PlannedTunnel[] = []
  for (const [start, end] of legRanges(cells)) {
    const leg = cells.slice(start, end)
    const local = planLeg(leg, conveyors, blocked, maxGap)
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
    const cover = coverCluster(leg, index, conveyors, blocked, maxGap)
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
 * Tunnel from the free cell before `start` through the following solid runs.
 * Runs separated by fewer than {@link TUNNEL_SPLIT_CELLS} free cells stay in
 * one underground span. Returns null when that span cannot be a legal pair.
 */
function coverCluster(
  leg: readonly StrokeCell[],
  start: number,
  conveyors: ReadonlySet<string>,
  blocked: ReadonlySet<string>,
  maxGap: number,
): { entrance: number; exit: number } | null {
  const entrance = start - 1
  // The cell behind the entrance must be a belt from this stroke. Otherwise the
  // portal would pull packets off the conveyor it is trying to cross.
  if (entrance < 1 || kind(leg[entrance - 1]!, conveyors, blocked) !== 'free') return null
  if (kind(leg[entrance]!, conveyors, blocked) !== 'free') return null

  let solidStart = start
  let hasConveyor = false
  while (solidStart < leg.length) {
    let solidEnd = solidStart
    while (solidEnd < leg.length && kind(leg[solidEnd]!, conveyors, blocked) !== 'free') {
      if (kind(leg[solidEnd]!, conveyors, blocked) === 'conveyor') hasConveyor = true
      solidEnd += 1
    }
    if (solidEnd >= leg.length) return null
    const gap = solidEnd - start
    if (gap < 1 || gap > maxGap) return null

    let nextSolid = solidEnd + 1
    while (nextSolid < leg.length && kind(leg[nextSolid]!, conveyors, blocked) === 'free') {
      nextSolid += 1
    }
    const freeRun = nextSolid - solidEnd
    const separated = nextSolid >= leg.length || freeRun >= TUNNEL_SPLIT_CELLS
    if (!separated) {
      solidStart = nextSolid
      continue
    }
    if (!hasConveyor) return null
    if (!outputClear(leg, solidEnd, conveyors, blocked)) return null
    const exit = leg[solidEnd]!
    const portal = leg[entrance]!
    if (!tunnelPairGeometry(portal, exit, portal.direction, maxGap).ok) return null
    return { entrance, exit: solidEnd }
  }
  return null
}

/** The exit ejects onto the next stroke cell, which this drag places as a belt. */
function outputClear(
  leg: readonly StrokeCell[],
  exitIndex: number,
  conveyors: ReadonlySet<string>,
  blocked: ReadonlySet<string>,
) {
  const next = exitIndex + 1
  return next < leg.length && kind(leg[next]!, conveyors, blocked) === 'free'
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
