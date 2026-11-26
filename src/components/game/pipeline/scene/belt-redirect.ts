import type { Direction } from '../model/frame.ts'
import type {
  StructurePlacementSession,
  StructurePreviewBelt,
  StructurePreviewMachine,
  StructurePlaceRequest,
} from '../structures/types.ts'
import { cellKey } from '../../../../../game-server/pipeline/geometry/cell.ts'
import { tunnelPairGeometry } from '../../../../../game-server/pipeline/machines/tunnel-machine.ts'
import {
  planBeltCrossings,
  readBeltCrossQuery,
  type BeltCrossPlan,
  type PlannedTunnel,
} from './belt-cross.ts'
import { getBeltPlaceDirection } from '../belt-place-options.ts'
import { BeltStroke, type StrokeCell } from './belt-stroke.ts'
import { projectStraightEnd } from './grid-math.ts'

/** Facing implied by dragging from a belt cell toward another cell. */
export function deriveDirectionFromDrag(
  origin: { x: number; y: number },
  end: { x: number; y: number },
): Direction | null {
  const projected = projectStraightEnd(origin, end)
  const dx = projected.x - origin.x
  const dy = projected.y - origin.y
  if (dx === 0 && dy === 0) return null
  if (dx > 0) return 'east'
  if (dx < 0) return 'west'
  if (dy > 0) return 'south'
  return 'north'
}

type RedirectBelt = { x: number; y: number; direction: Direction; authorId?: string; speed?: number }

type GridPoint = { x: number; y: number }

type RedirectPlan = BeltCrossPlan & { clearBelts: GridPoint[] }

type BeltPayload = {
  cells: StrokeCell[]
  speed?: number
  tunnels?: PlannedTunnel[]
  clearBelts?: GridPoint[]
}

function previewPortal(
  tunnel: PlannedTunnel,
  role: 'entrance' | 'exit',
  tunnelMachineId: 'tunnel' | 'fast_tunnel',
): StructurePreviewMachine {
  return {
    machineId: tunnelMachineId,
    x: role === 'entrance' ? tunnel.entranceX : tunnel.exitX,
    y: role === 'entrance' ? tunnel.entranceY : tunnel.exitY,
    facing: tunnel.facing,
    width: 1,
    height: 1,
    tunnelRole: role,
    placementValid: true,
  }
}

export type BeltRedirectOptions = {
  /**
   * Speed written on commit. Defaults to the clicked belt's speed.
   * Pass the selected tool speed so a click or drag upgrades or downgrades.
   */
  placeSpeed?: number
}

/**
 * Drag from an owned belt: reorient the first cell, rewrite owned belts along
 * the stroke at `placeSpeed`, and tunnel any later conveyors the stroke crosses.
 */
export function createBeltRedirectSession(
  belt: RedirectBelt,
  options?: BeltRedirectOptions,
): StructurePlacementSession {
  // A plain click applies the selected orientation; a drag overrides it.
  const stroke = new BeltStroke(getBeltPlaceDirection())
  stroke.push({ x: belt.x, y: belt.y })
  const initialDirection = belt.direction
  const existingSpeed = belt.speed ?? 1
  const placeSpeed = options?.placeSpeed ?? existingSpeed
  const fast = placeSpeed > 1
  const structureId = fast ? 'fast_belt' : 'belt'
  const tunnelMachineId = fast ? 'fast_tunnel' : 'tunnel'

  const plan = (): RedirectPlan => {
    const query = readBeltCrossQuery()
    const { conveyors, blocked } = query.occupancy()
    // The clicked belt is rewritten, so it counts as a new belt for tunneling.
    // Every other conveyor stays in the crossing set and can become a tunnel.
    const originKey = cellKey({ x: belt.x, y: belt.y })
    const others = new Set([...conveyors].filter((key) => key !== originKey))
    const crossed = planBeltCrossings(
      stroke.cells,
      others,
      blocked,
      query.maxGap(),
      query.ports?.() ?? [],
    )
    const withOrigin = keepOriginBelt(stroke.cells, crossed)
    const bridged = bridgeFollowingConveyors(
      stroke.cells,
      withOrigin,
      conveyors,
      blocked,
      query.maxGap(),
      belt.authorId,
    )
    // Crossing planner omits solid owned runs that cannot become tunnels. Put
    // those cells back so a held drag can upgrade/downgrade a stretch.
    return includeOwnedStrokeBelts(stroke.cells, bridged, belt.authorId)
  }

  return {
    push(cell) {
      return stroke.push(cell)
    },
    previewBelts(): StructurePreviewBelt[] {
      return plan().belts.map((cell, index) => ({
        id: `redirect-${index}`,
        x: cell.x,
        y: cell.y,
        direction: cell.direction,
        ...(placeSpeed > 1 ? { speed: placeSpeed } : {}),
        authorId: '',
        authorNickname: '',
        placedAt: index,
      }))
    },
    previewMachines(): StructurePreviewMachine[] {
      return plan().tunnels.flatMap((tunnel) => [
        previewPortal(tunnel, 'entrance', tunnelMachineId),
        previewPortal(tunnel, 'exit', tunnelMachineId),
      ])
    },
    isEmpty() {
      return false
    },
    finish(): StructurePlaceRequest | null {
      const next = plan()
      if (next.belts.length === 0 && next.tunnels.length === 0) return null
      if (isNoOpBeltPaint(next, belt, initialDirection, placeSpeed)) return null
      const payload: BeltPayload = { cells: next.belts }
      if (fast) payload.speed = placeSpeed
      if (next.tunnels.length > 0) payload.tunnels = next.tunnels
      if (next.clearBelts.length > 0) payload.clearBelts = next.clearBelts
      return { structureId, payload }
    },
  }
}

/** Re-add owned belts the crossing planner omitted so a drag can re-speed them. */
function includeOwnedStrokeBelts(
  cells: readonly StrokeCell[],
  planned: RedirectPlan,
  ownerId: string | undefined,
): RedirectPlan {
  if (!ownerId) return planned
  const records = readBeltCrossQuery().belts?.() ?? []
  const covered = tunnelSpanKeys(cells, planned.tunnels)
  const byKey = new Map(planned.belts.map((cell) => [cellKey(cell), cell]))
  let added = false
  for (const cell of cells) {
    const key = cellKey(cell)
    if (byKey.has(key) || covered.has(key) || portalUses(planned.tunnels, cell)) continue
    const existing = records.find((item) => item.x === cell.x && item.y === cell.y)
    if (!existing) continue
    byKey.set(key, cell)
    added = true
  }
  if (!added) return planned
  const ordered = cells.filter((cell) => byKey.has(cellKey(cell))).map((cell) => byKey.get(cellKey(cell))!)
  return { ...planned, belts: ordered }
}

function isNoOpBeltPaint(
  planned: RedirectPlan,
  origin: RedirectBelt,
  initialDirection: Direction,
  placeSpeed: number,
) {
  if (planned.tunnels.length > 0 || planned.clearBelts.length > 0) return false
  const records = readBeltCrossQuery().belts?.() ?? []
  if (planned.belts.length === 0) return true
  if (
    planned.belts.length === 1 &&
    planned.belts[0]?.x === origin.x &&
    planned.belts[0]?.y === origin.y &&
    planned.belts[0]?.direction === initialDirection &&
    placeSpeed === (origin.speed ?? 1)
  ) {
    return true
  }
  return planned.belts.every((cell) => {
    const existing = records.find((item) => item.x === cell.x && item.y === cell.y)
    if (!existing) return false
    return (
      existing.authorId === origin.authorId &&
      (existing.speed ?? 1) === placeSpeed &&
      existing.direction === cell.direction
    )
  })
}

/** The clicked belt keeps the stroke facing unless a portal already uses that cell. */
function keepOriginBelt(cells: readonly StrokeCell[], planned: BeltCrossPlan): RedirectPlan {
  const origin = cells[0]
  const base: RedirectPlan = { ...planned, clearBelts: [] }
  if (!origin) return base
  const placed = base.belts.some((cell) => cell.x === origin.x && cell.y === origin.y)
  if (placed || portalUses(base.tunnels, origin)) return base
  return { ...base, belts: [origin, ...base.belts] }
}

/**
 * A conveyor run that starts on the cell after the redirected belt has no free
 * entrance in front of it. When that belt is ours, the run's first cell becomes
 * the entrance (cleared first) and a later free cell the exit.
 */
function bridgeFollowingConveyors(
  cells: readonly StrokeCell[],
  planned: RedirectPlan,
  conveyors: ReadonlySet<string>,
  blocked: ReadonlySet<string>,
  maxGap: number,
  ownerId: string | undefined,
): RedirectPlan {
  const covered = tunnelSpanKeys(cells, planned.tunnels)
  const beltKeys = new Set(planned.belts.map((cell) => cellKey(cell)))
  let index = 1
  const tunnels = [...planned.tunnels]
  const clearBelts = [...planned.clearBelts]
  const drop = new Set<string>()

  while (index < cells.length) {
    const cell = cells[index]!
    const key = cellKey(cell)
    if (!conveyors.has(key) || covered.has(key) || blocked.has(key)) {
      index += 1
      continue
    }
    const approach = cells[index - 1]!
    if (!beltKeys.has(cellKey(approach)) || !samePoint(approach, cells[0]!)) {
      index += 1
      continue
    }
    let runEnd = index
    while (runEnd < cells.length) {
      const cursor = cells[runEnd]!
      const cursorKey = cellKey(cursor)
      if (!conveyors.has(cursorKey) || covered.has(cursorKey) || cursor.direction !== cell.direction) {
        break
      }
      runEnd += 1
    }
    const bridged = bridgeRun(cells, index, runEnd, beltKeys, conveyors, blocked, maxGap, ownerId)
    if (!bridged) {
      index = runEnd
      continue
    }
    tunnels.push(bridged.tunnel)
    for (const clear of bridged.clearBelts) clearBelts.push(clear)
    for (let cursor = index; cursor <= bridged.exitIndex; cursor++) drop.add(cellKey(cells[cursor]!))
    beltKeys.delete(cellKey(cells[bridged.exitIndex]!))
    index = bridged.exitIndex + 1
  }

  if (tunnels.length === planned.tunnels.length) return planned
  return {
    belts: planned.belts.filter((cell) => !drop.has(cellKey(cell))),
    tunnels,
    clearBelts,
  }
}

function bridgeRun(
  cells: readonly StrokeCell[],
  runStart: number,
  runEnd: number,
  beltKeys: ReadonlySet<string>,
  conveyors: ReadonlySet<string>,
  blocked: ReadonlySet<string>,
  maxGap: number,
  ownerId: string | undefined,
): { tunnel: PlannedTunnel; exitIndex: number; clearBelts: GridPoint[] } | null {
  const entrance = cells[runStart]
  if (!entrance || !canClearBelt(entrance, ownerId)) return null
  const firstExit = Math.max(runStart + 2, runEnd)
  for (let exitIndex = firstExit; exitIndex < cells.length - 1; exitIndex++) {
    const exit = cells[exitIndex]!
    const after = cells[exitIndex + 1]!
    if (exit.direction !== entrance.direction) break
    if (blocked.has(cellKey(exit))) break
    if (!beltKeys.has(cellKey(after))) continue
    const geometry = tunnelPairGeometry(entrance, exit, entrance.direction, maxGap)
    if (!geometry.ok) continue
    const exitKey = cellKey(exit)
    if (conveyors.has(exitKey) && !canClearBelt(exit, ownerId)) continue
    const clearBelts: GridPoint[] = [{ x: entrance.x, y: entrance.y }]
    if (conveyors.has(exitKey)) clearBelts.push({ x: exit.x, y: exit.y })
    return {
      exitIndex,
      clearBelts,
      tunnel: {
        entranceX: entrance.x,
        entranceY: entrance.y,
        exitX: exit.x,
        exitY: exit.y,
        facing: entrance.direction,
      },
    }
  }
  return null
}

function canClearBelt(cell: GridPoint, ownerId: string | undefined) {
  if (!ownerId) return false
  const records = readBeltCrossQuery().belts?.() ?? []
  const found = records.find((item) => item.x === cell.x && item.y === cell.y)
  return Boolean(found)
}

function tunnelSpanKeys(cells: readonly StrokeCell[], tunnels: readonly PlannedTunnel[]) {
  const covered = new Set<string>()
  for (const tunnel of tunnels) {
    let on = false
    for (const cell of cells) {
      if (cell.x === tunnel.entranceX && cell.y === tunnel.entranceY) on = true
      if (on) covered.add(cellKey(cell))
      if (cell.x === tunnel.exitX && cell.y === tunnel.exitY) {
        on = false
        break
      }
    }
  }
  return covered
}

function portalUses(tunnels: readonly PlannedTunnel[], cell: GridPoint) {
  return tunnels.some(
    (tunnel) =>
      (tunnel.entranceX === cell.x && tunnel.entranceY === cell.y) ||
      (tunnel.exitX === cell.x && tunnel.exitY === cell.y),
  )
}

function samePoint(a: GridPoint, b: GridPoint) {
  return a.x === b.x && a.y === b.y
}
