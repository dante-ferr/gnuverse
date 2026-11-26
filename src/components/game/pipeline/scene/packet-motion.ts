import {
  ahead,
  opposite,
  type Direction,
} from '../../../../../game-server/pipeline/geometry/direction.ts'
import { CombinerMachine } from '../../../../../game-server/pipeline/machines/combiner-machine.ts'
import { SplitterMachine } from '../../../../../game-server/pipeline/machines/splitter-machine.ts'
import { TrashcanMachine } from '../../../../../game-server/pipeline/machines/trashcan-machine.ts'
import { TunnelPortalMachine } from '../../../../../game-server/pipeline/machines/tunnel-machine.ts'
import { CoreMachine } from '../../../../../game-server/pipeline/machines/core-machine.ts'
import { SourceMachine } from '../../../../../game-server/pipeline/machines/source-machine.ts'
import type { BeltRecord, PipelineFrame, PipelineRules } from '../model/frame.ts'

export type PacketSink = {
  id: string
  shape: string
  startPx: number
  startPy: number
  endPx: number
  endPy: number
  startedAtMs: number
  /**
   * Same-tick tunnel pass-through: the sink is drawn above portals by the
   * occupancy painter, and this newborn packet stays hidden until the flight ends.
   */
  hidesPacketId?: string
  /** Draw above machines (tunnel span) instead of under the portal plate. */
  overPortals?: boolean
}

export type PacketMotionState = {
  lastTick: number
  syncedAtMs: number
  /** Cell at the previous server tick (lerp start for the step that just completed). */
  from: Map<string, { x: number; y: number }>
  /** Authoritative cells after the latest frame event. */
  at: Map<string, { x: number; y: number; shape: string }>
  /** Packets absorbed by a machine input, animating under the machine body. */
  sinks: PacketSink[]
  /** Belt at each cell for the latest tick. Lookups stay O(1) while interpolating. */
  beltByCell: Map<string, BeltRecord>
  /** Belt walk for the current tick, filled on first use and cleared when the tick changes. */
  paths: Map<string, { x: number; y: number }[]>
  /**
   * World-pixel polyline for this hop when it must continue from a mid-cell
   * position. Empty means the hop starts on the previous cell center.
   */
  course: Map<string, { px: number; py: number }[]>
  /** Geometry stamp for `beltByCell`. Updates when belts change without a new tick. */
  layoutStamp: number
  /**
   * Chunk that frame cell (0,0) belongs to. Buying a chunk west or north moves it,
   * which shifts every cell coordinate; stored cells must shift with it.
   */
  originChunk: { cx: number; cy: number } | null
}

export function createPacketMotionState(): PacketMotionState {
  return {
    lastTick: -1,
    syncedAtMs: 0,
    from: new Map(),
    at: new Map(),
    sinks: [],
    beltByCell: new Map(),
    paths: new Map(),
    course: new Map(),
    layoutStamp: -1,
    originChunk: null,
  }
}

/** True while a same-tick tunnel flight is still covering this newborn packet. */
export function packetHiddenByTunnelPass(state: PacketMotionState, packetId: string, nowMs: number, tickMs: number) {
  const life = tickMs > 0 ? tickMs : 250
  return state.sinks.some(
    (sink) =>
      sink.hidesPacketId === packetId && nowMs - sink.startedAtMs < life,
  )
}

/** Call once per paint when the pipeline frame tick advances (or on first frame). */
export function syncPacketMotion(
  state: PacketMotionState,
  frame: PipelineFrame,
  rules: PipelineRules,
  nowMs: number,
  cellSize: number,
) {
  const tickMs = rules.tickMs > 0 ? rules.tickMs : 250
  rebaseOnOriginShift(state, frame, rules, cellSize)
  state.sinks = state.sinks.filter((sink) => nowMs - sink.startedAtMs < tickMs)

  const tickAdvanced = frame.tick !== state.lastTick
  const continuations = new Map<string, { px: number; py: number }[]>()
  if (tickAdvanced && state.lastTick >= 0 && nowMs > state.syncedAtMs) {
    for (const packet of frame.packets) {
      const prev = state.at.get(packet.id)
      if (!prev) continue
      const course = continuationCourse(
        state,
        { id: packet.id, x: packet.x, y: packet.y, shape: packet.shape },
        prev,
        frame,
        rules,
        nowMs,
        cellSize,
      )
      if (course) continuations.set(packet.id, course)
    }
  }

  const stamp = beltLayoutStamp(frame.belts)
  if (stamp !== state.layoutStamp) {
    state.beltByCell = indexBelts(frame)
    state.layoutStamp = stamp
    state.paths = new Map()
    state.course = new Map()
  }

  if (!tickAdvanced) return

  const nextIds = new Set(frame.packets.map((packet) => packet.id))
  const maxHop = Math.max(rules.beltSpeedFast, 1)
  const transitLeft = tunnelTransitPool(frame)
  const claimedNewborns = new Set<string>()

  for (const [id, prev] of state.at) {
    if (nextIds.has(id)) continue
    const dest = findInputAlongBelt(frame, prev, state.beltByCell, maxHop)
    if (!dest) continue

    const ghostFrame: PipelineFrame = {
      ...frame,
      packets: [{ id, x: prev.x, y: prev.y, shape: prev.shape }],
    }
    const start = packetDisplayCenter({ id, x: prev.x, y: prev.y }, ghostFrame, rules, state, nowMs, cellSize)
    const through = tunnelThroughSink(frame, dest, prev.shape, transitLeft, claimedNewborns)
    const end = through?.end ?? dest
    const endPx = cellCenter(end.x, end.y, cellSize)
    state.sinks.push({
      id,
      shape: prev.shape,
      startPx: start.px,
      startPy: start.py,
      endPx: endPx.px,
      endPy: endPx.py,
      startedAtMs: nowMs,
      ...(through
        ? { hidesPacketId: through.hidesPacketId, overPortals: true as const }
        : {}),
    })
  }

  // Machine → gap-0 tunnel with no prior belt packet still needs one flight.
  let synthetic = 0
  for (const [pairId, shapes] of transitLeft) {
    const portals = tunnelPairCells(frame, pairId)
    if (!portals) continue
    for (const shape of shapes) {
      const newborn = claimExitNewborn(frame, portals.exit, shape, claimedNewborns)
      const end = newborn ? { x: newborn.x, y: newborn.y } : portals.exit
      const startPx = cellCenter(portals.entrance.x, portals.entrance.y, cellSize)
      const endPx = cellCenter(end.x, end.y, cellSize)
      state.sinks.push({
        id: `tunnel-pass:${pairId}:${synthetic++}:${shape}`,
        shape,
        startPx: startPx.px,
        startPy: startPx.py,
        endPx: endPx.px,
        endPy: endPx.py,
        startedAtMs: nowMs,
        hidesPacketId: newborn?.id,
        overPortals: true,
      })
    }
  }

  state.paths = new Map()
  state.course = continuations
  const nextFrom = new Map<string, { x: number; y: number }>()
  for (const packet of frame.packets) {
    const prev = state.at.get(packet.id)
    if (prev) {
      nextFrom.set(packet.id, prev)
      continue
    }
    if (claimedNewborns.has(packet.id)) {
      // Covered by the through-tunnel sink; do not spawn-shoot from the exit.
      nextFrom.set(packet.id, { x: packet.x, y: packet.y })
      continue
    }
    nextFrom.set(packet.id, spawnOrigin(frame, packet.x, packet.y, state.beltByCell, maxHop))
  }
  state.from = nextFrom
  state.at = new Map(
    frame.packets.map((packet) => [packet.id, { x: packet.x, y: packet.y, shape: packet.shape }]),
  )
  state.lastTick = frame.tick
  state.syncedAtMs = nowMs
}

/**
 * Translate stored cells and pixels when the frame origin chunk moves, so
 * packets keep animating in place instead of flying across the room.
 */
function rebaseOnOriginShift(
  state: PacketMotionState,
  frame: PipelineFrame,
  rules: PipelineRules,
  cellSize: number,
) {
  const origin = frame.originChunk ?? { cx: 0, cy: 0 }
  const previous = state.originChunk
  state.originChunk = { cx: origin.cx, cy: origin.cy }
  if (!previous) return
  const dx = (previous.cx - origin.cx) * rules.chunkSize
  const dy = (previous.cy - origin.cy) * rules.chunkSize
  if (dx === 0 && dy === 0) return
  const dpx = dx * cellSize
  const dpy = dy * cellSize
  for (const cell of state.from.values()) {
    cell.x += dx
    cell.y += dy
  }
  for (const cell of state.at.values()) {
    cell.x += dx
    cell.y += dy
  }
  for (const sink of state.sinks) {
    sink.startPx += dpx
    sink.startPy += dpy
    sink.endPx += dpx
    sink.endPy += dpy
  }
  for (const points of state.course.values()) {
    for (const point of points) {
      point.px += dpx
      point.py += dpy
    }
  }
  state.paths = new Map()
  state.beltByCell = indexBelts(frame)
  state.layoutStamp = beltLayoutStamp(frame.belts)
}

function tunnelTransitPool(frame: PipelineFrame) {
  const pool = new Map<string, string[]>()
  for (const portal of frame.tunnels ?? []) {
    if (portal.role !== 'entrance') continue
    const transit = portal.transit ?? []
    if (transit.length === 0) continue
    pool.set(portal.pairId, [...transit])
  }
  return pool
}

function tunnelPairCells(frame: PipelineFrame, pairId: string) {
  let entrance: { x: number; y: number } | null = null
  let exit: { x: number; y: number; direction: Direction } | null = null
  for (const portal of frame.tunnels ?? []) {
    if (portal.pairId !== pairId) continue
    if (portal.role === 'entrance') entrance = { x: portal.x, y: portal.y }
    if (portal.role === 'exit') exit = { x: portal.x, y: portal.y, direction: portal.direction }
  }
  if (!entrance || !exit) return null
  return { entrance, exit }
}

function tunnelEntranceAt(frame: PipelineFrame, cell: { x: number; y: number }) {
  for (const portal of frame.tunnels ?? []) {
    if (portal.role !== 'entrance') continue
    if (portal.x === cell.x && portal.y === cell.y) return portal
  }
  return null
}

/**
 * When a packet enters a tunnel and leaves in the same tick (`transit`), aim the
 * sink at the exit (or the newborn exit-belt packet) so the element shoots once.
 */
function tunnelThroughSink(
  frame: PipelineFrame,
  dest: { x: number; y: number },
  shape: string,
  transitLeft: Map<string, string[]>,
  claimedNewborns: Set<string>,
): { end: { x: number; y: number }; hidesPacketId?: string } | null {
  const entrance = tunnelEntranceAt(frame, dest)
  if (!entrance) return null
  const left = transitLeft.get(entrance.pairId)
  if (!left) return null
  const index = left.indexOf(shape)
  if (index < 0) return null
  left.splice(index, 1)
  if (left.length === 0) transitLeft.delete(entrance.pairId)

  const portals = tunnelPairCells(frame, entrance.pairId)
  if (!portals) return { end: dest }
  const newborn = claimExitNewborn(frame, portals.exit, shape, claimedNewborns)
  if (newborn) return { end: { x: newborn.x, y: newborn.y }, hidesPacketId: newborn.id }
  return { end: portals.exit }
}

function claimExitNewborn(
  frame: PipelineFrame,
  exit: { x: number; y: number; direction: Direction },
  shape: string,
  claimedNewborns: Set<string>,
) {
  const out = ahead(exit.x, exit.y, exit.direction)
  for (const packet of frame.packets) {
    if (claimedNewborns.has(packet.id)) continue
    if (packet.shape !== shape) continue
    if (packet.x === out.x && packet.y === out.y) {
      claimedNewborns.add(packet.id)
      return packet
    }
    // Gap-0 may also land on a linked machine input; accept the exit cell itself.
    if (packet.x === exit.x && packet.y === exit.y) {
      claimedNewborns.add(packet.id)
      return packet
    }
  }
  return null
}

/**
 * Invented previous cell for a packet that just appeared on a belt.
 * Prefer the machine port behind an output slot so sideways / parallel belts
 * still animate out of the machine instead of from empty air behind the belt.
 * Walks upstream on fast lines so same-tick multi-hop ejects still start at the port.
 */
function spawnOrigin(
  frame: PipelineFrame,
  x: number,
  y: number,
  belts?: Map<string, BeltRecord>,
  maxUpstream = 1,
) {
  let cell = { x, y }
  for (let step = 0; step <= maxUpstream; step++) {
    const fromPort = outputPortOrigin(frame, cell.x, cell.y)
    if (fromPort) return fromPort
    if (step === maxUpstream) break
    const belt = beltAt(frame, cell.x, cell.y, belts)
    if (!belt) break
    cell = ahead(cell.x, cell.y, opposite(belt.direction))
  }
  const belt = beltAt(frame, x, y, belts)
  if (!belt) return { x, y }
  return ahead(x, y, opposite(belt.direction))
}

function outputPortOrigin(frame: PipelineFrame, x: number, y: number) {
  const cell = { x, y }
  const sources = frame.sources?.length ? frame.sources : [frame.source]
  for (const spec of sources) {
    const source = new SourceMachine(spec.id, { x: spec.x, y: spec.y }, spec.direction, spec.shape, 1)
    const slot = source.slotAt(cell, 'output')
    if (slot) return ahead(x, y, opposite(slot.travel))
  }
  for (const spec of frame.combiners ?? []) {
    const machine = new CombinerMachine(
      spec.id,
      spec.machineId,
      { x: spec.x, y: spec.y },
      spec.facing,
    )
    const slot = machine.slotAt(cell, 'output')
    if (slot) return ahead(x, y, opposite(slot.travel))
  }
  for (const spec of frame.splitters ?? []) {
    const machine = new SplitterMachine(
      spec.id,
      { x: spec.x, y: spec.y },
      spec.facing,
      { id: '', nickname: '' },
    )
    const slot = machine.slotAt(cell, 'output')
    if (slot) return ahead(x, y, opposite(slot.travel))
  }
  for (const spec of frame.tunnels ?? []) {
    if (spec.role !== 'exit') continue
    const machine = new TunnelPortalMachine(
      spec.id,
      { x: spec.x, y: spec.y },
      spec.role,
      spec.pairId,
      spec.direction,
      { id: '', nickname: '' },
    )
    const slot = machine.slotAt(cell, 'output')
    if (slot) return ahead(x, y, opposite(slot.travel))
  }
  return null
}

function beltLayoutStamp(belts: BeltRecord[]) {
  let h = belts.length
  for (const belt of belts) {
    h = Math.imul(h, 33) ^ belt.x
    h = Math.imul(h, 33) ^ belt.y
    h = Math.imul(h, 33) ^ belt.direction.charCodeAt(0)
    h = Math.imul(h, 33) ^ (belt.speed ?? 1)
  }
  return h >>> 0
}

function indexBelts(frame: PipelineFrame) {
  const index = new Map<string, BeltRecord>()
  for (const belt of frame.belts) index.set(`${belt.x},${belt.y}`, belt)
  return index
}

function beltAt(frame: PipelineFrame, x: number, y: number, index?: Map<string, BeltRecord>) {
  if (index) return index.get(`${x},${y}`)
  return frame.belts.find((belt) => belt.x === x && belt.y === y)
}

/** Cells a packet may paint in this tick: the belt walk, plus one outbound cell for glyph overhang. */
export function packetClipCells(
  packet: { id: string; x: number; y: number },
  state: PacketMotionState,
  cellPx: number,
) {
  const cells: { x: number; y: number }[] = []
  const seen = new Set<string>()
  const add = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    const key = `${x},${y}`
    if (seen.has(key)) return
    seen.add(key)
    cells.push({ x, y })
  }

  const path = state.paths.get(packet.id)
  if (path && path.length > 0) {
    for (const cell of path) add(cell.x, cell.y)
  } else {
    add(packet.x, packet.y)
  }

  const course = state.course.get(packet.id)
  if (course && cellPx > 0) {
    for (const point of course) {
      add(Math.round(point.px / cellPx - 0.5), Math.round(point.py / cellPx - 0.5))
    }
  }

  const belt = state.beltByCell.get(`${packet.x},${packet.y}`)
  if (belt) {
    const next = ahead(packet.x, packet.y, belt.direction)
    add(next.x, next.y)
  }
  return cells
}

/** True when `cell` is an input slot that can absorb a packet (core, craft, splitter, tunnel, trash). */
function isMachineInputCell(frame: PipelineFrame, cell: { x: number; y: number }) {
  return machineInputAt(frame, cell) !== null
}

/** Input slot cell when `approach` sits directly behind an accepting port. */
function inputFromApproach(frame: PipelineFrame, approach: { x: number; y: number }) {
  for (const input of allInputCells(frame)) {
    const behind = ahead(input.x, input.y, opposite(input.travel))
    if (sameCell(behind, approach)) return { x: input.x, y: input.y }
  }
  return null
}

function machineInputAt(frame: PipelineFrame, cell: { x: number; y: number }) {
  for (const input of allInputCells(frame)) {
    if (sameCell(input, cell)) return input
  }
  return null
}

function allInputCells(frame: PipelineFrame): { x: number; y: number; travel: Direction }[] {
  const out: { x: number; y: number; travel: Direction }[] = []
  const cores = frame.cores?.length
    ? frame.cores
    : [{ id: frame.core.id, x: frame.core.x, y: frame.core.y }]
  for (const spec of cores) {
    const core = new CoreMachine(spec.id, { x: spec.x, y: spec.y })
    for (const slot of core.inputSlots()) out.push({ x: slot.cell.x, y: slot.cell.y, travel: slot.travel })
  }
  for (const spec of frame.combiners ?? []) {
    const machine = new CombinerMachine(
      spec.id,
      spec.machineId,
      { x: spec.x, y: spec.y },
      spec.facing,
    )
    for (const slot of machine.inputSlots()) out.push({ x: slot.cell.x, y: slot.cell.y, travel: slot.travel })
  }
  for (const spec of frame.splitters ?? []) {
    const machine = new SplitterMachine(
      spec.id,
      { x: spec.x, y: spec.y },
      spec.facing,
      { id: '', nickname: '' },
    )
    for (const slot of machine.inputSlots()) out.push({ x: slot.cell.x, y: slot.cell.y, travel: slot.travel })
  }
  for (const spec of frame.trashcans ?? []) {
    const machine = new TrashcanMachine(
      spec.id,
      { x: spec.x, y: spec.y },
      spec.facing,
      { id: '', nickname: '' },
    )
    for (const slot of machine.inputSlots()) out.push({ x: slot.cell.x, y: slot.cell.y, travel: slot.travel })
  }
  for (const spec of frame.tunnels ?? []) {
    if (spec.role !== 'entrance') continue
    const portal = new TunnelPortalMachine(
      spec.id,
      { x: spec.x, y: spec.y },
      spec.role,
      spec.pairId,
      spec.direction,
      { id: '', nickname: '' },
    )
    for (const slot of portal.inputSlots()) out.push({ x: slot.cell.x, y: slot.cell.y, travel: slot.travel })
  }
  return out
}

/**
 * Fast belts may absorb several cells past the last painted position in one tick.
 * Walk forward along the belt (and approach pull) to find the input that took the packet.
 */
function findInputAlongBelt(
  frame: PipelineFrame,
  start: { x: number; y: number },
  belts: Map<string, BeltRecord> | undefined,
  maxSteps: number,
) {
  let cell = start
  for (let step = 0; step <= maxSteps; step++) {
    const pulled = inputFromApproach(frame, cell)
    if (pulled) return pulled
    const belt = beltAt(frame, cell.x, cell.y, belts)
    if (!belt) return null
    const next = ahead(cell.x, cell.y, belt.direction)
    if (isMachineInputCell(frame, next)) return next
    if (step === maxSteps) return null
    cell = next
  }
  return null
}

function cellCenter(x: number, y: number, cellSize: number) {
  return { px: (x + 0.5) * cellSize, py: (y + 0.5) * cellSize }
}

function sameCell(a: { x: number; y: number }, b: { x: number; y: number }) {
  return a.x === b.x && a.y === b.y
}

function cellKey(cell: { x: number; y: number }) {
  return `${cell.x},${cell.y}`
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function neighbors4(cell: { x: number; y: number }) {
  return [
    { x: cell.x + 1, y: cell.y },
    { x: cell.x - 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x, y: cell.y - 1 },
  ]
}

/**
 * Reconstruct the surface belt walk from `from` → `to` (including multi-hop
 * fast-belt corners). On a belt cell only the outbound direction is allowed;
 * off-belt cells (spawn origin) may step onto any orthogonal neighbor.
 */
function findBeltPath(
  frame: PipelineFrame,
  from: { x: number; y: number },
  to: { x: number; y: number },
  maxSteps: number,
  belts?: Map<string, BeltRecord>,
): { x: number; y: number }[] | null {
  if (sameCell(from, to)) return [from]
  type Node = { cell: { x: number; y: number }; path: { x: number; y: number }[] }
  const queue: Node[] = [{ cell: from, path: [from] }]
  const seen = new Set([cellKey(from)])
  while (queue.length > 0) {
    const { cell, path } = queue.shift()!
    if (path.length > maxSteps + 1) continue
    const belt = beltAt(frame, cell.x, cell.y, belts)
    const nexts = belt ? [ahead(cell.x, cell.y, belt.direction)] : neighbors4(cell)
    for (const next of nexts) {
      const key = cellKey(next)
      if (seen.has(key)) continue
      const nextPath = [...path, next]
      if (sameCell(next, to)) return nextPath
      seen.add(key)
      if (nextPath.length <= maxSteps + 1) queue.push({ cell: next, path: nextPath })
    }
  }
  return null
}

type WorldPoint = { px: number; py: number }

/** Point `distance` pixels along a polyline. Extra distance holds on the last point. */
function pointAlong(points: WorldPoint[], distance: number): WorldPoint {
  if (points.length === 0) return { px: 0, py: 0 }
  if (points.length === 1 || distance <= 0) return points[0]!
  let remain = distance
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const len = Math.hypot(b.px - a.px, b.py - a.py)
    if (remain <= len || i === points.length - 1) {
      const u = len < 1e-6 ? 1 : Math.min(1, remain / len)
      return { px: lerp(a.px, b.px, u), py: lerp(a.py, b.py, u) }
    }
    remain -= len
  }
  return points[points.length - 1]!
}

/** Untraveled suffix of `points`, starting at `distance` along the polyline. */
function suffixAfter(points: WorldPoint[], distance: number): WorldPoint[] {
  if (points.length === 0) return []
  if (distance <= 0) return points.slice()
  let remain = distance
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const len = Math.hypot(b.px - a.px, b.py - a.py)
    if (remain < len - 1e-4) {
      const u = len < 1e-6 ? 1 : remain / len
      return [{ px: lerp(a.px, b.px, u), py: lerp(a.py, b.py, u) }, ...points.slice(i + 1)]
    }
    remain -= len
  }
  return [points[points.length - 1]!]
}

function dedupePoints(points: WorldPoint[]) {
  const out: WorldPoint[] = []
  for (const point of points) {
    const prev = out[out.length - 1]
    if (prev && Math.hypot(prev.px - point.px, prev.py - point.py) < 0.5) continue
    out.push(point)
  }
  return out
}

/**
 * Polyline for the hop that is on screen now. A stored course keeps a mid-cell
 * start so the next server tick does not snap the icon back to a cell center.
 */
function hopPolyline(
  packet: { id: string; x: number; y: number },
  frame: PipelineFrame,
  rules: PipelineRules,
  state: PacketMotionState,
  cellSize: number,
): { poly: WorldPoint[]; pxPerMs: number } {
  const to = { x: packet.x, y: packet.y }
  const from = state.from.get(packet.id) ?? to
  const tickMs = rules.tickMs > 0 ? rules.tickMs : 250
  const maxSteps = Math.max(rules.beltSpeedFast, 1) + 2
  if (!state.paths.has(packet.id)) {
    state.paths.set(packet.id, findBeltPath(frame, from, to, maxSteps, state.beltByCell) ?? [])
  }
  const path = state.paths.get(packet.id)
  const speed = hopBeltSpeed(frame, path && path.length > 0 ? path : undefined, to, state.beltByCell)
  const pxPerMs = (cellSize * speed) / tickMs
  const custom = state.course.get(packet.id)
  if (custom && custom.length >= 2) return { poly: custom, pxPerMs }

  const cells =
    path && path.length >= 2 ? path : sameCell(from, to) ? [to] : [from, to]
  const poly = cells.map((cell) => cellCenter(cell.x, cell.y, cellSize))
  if (poly.length === 1) poly.push(poly[0]!)
  return { poly, pxPerMs }
}

/**
 * When the next tick arrives before the icon has reached the previous cell,
 * keep the unfinished polyline and append the new belt walk. On-time and late
 * ticks return null so the hop starts on the cell center the icon is already on.
 */
function continuationCourse(
  state: PacketMotionState,
  packet: { id: string; x: number; y: number; shape: string },
  prev: { x: number; y: number },
  frame: PipelineFrame,
  rules: PipelineRules,
  nowMs: number,
  cellSize: number,
) {
  const ghost = { id: packet.id, x: prev.x, y: prev.y, shape: packet.shape }
  const { poly, pxPerMs } = hopPolyline(ghost, frame, rules, state, cellSize)
  const elapsed = Math.max(0, nowMs - state.syncedAtMs)
  const suffix = suffixAfter(poly, pxPerMs * elapsed)
  if (suffix.length < 2) return null
  const end = poly[poly.length - 1]
  const start = suffix[0]
  if (end && start && Math.hypot(start.px - end.px, start.py - end.py) < 0.5) return null

  const maxSteps = Math.max(rules.beltSpeedFast, 1) + 2
  const next = { x: packet.x, y: packet.y }
  const path =
    findBeltPath(frame, prev, next, maxSteps, state.beltByCell) ??
    (sameCell(prev, next) ? [prev] : [prev, next])
  const centers = path.map((cell) => cellCenter(cell.x, cell.y, cellSize))
  const joined = end
    ? centers.filter((point, index) => index > 0 || Math.hypot(point.px - end.px, point.py - end.py) >= 0.5)
    : centers
  const merged = dedupePoints([...suffix, ...joined])
  return merged.length >= 2 ? merged : null
}

/**
 * Belt speed used to pace a hop. Short exit/approach hops on a fast belt must
 * finish in hopCells/speed of a tick so visual speed stays constant (otherwise
 * a 1-cell port exit crawls, then the next 3-cell hop zooms).
 */
function hopBeltSpeed(
  frame: PipelineFrame,
  path: { x: number; y: number }[] | undefined,
  to: { x: number; y: number },
  belts?: Map<string, BeltRecord>,
) {
  if (path) {
    for (let i = path.length - 1; i >= 0; i--) {
      const cell = path[i]!
      const belt = beltAt(frame, cell.x, cell.y, belts)
      if (belt) return Math.max(1, belt.speed ?? 1)
    }
  }
  const belt = beltAt(frame, to.x, to.y, belts)
  return Math.max(1, belt?.speed ?? 1)
}

/**
 * Screen-space center for a packet. Motion stays on the belt polyline at belt
 * speed and holds on the server cell when the next tick is late — it does not
 * run ahead, because the following tick would pull the icon backward.
 */
export function packetDisplayCenter(
  packet: { id: string; x: number; y: number; shape?: string },
  frame: PipelineFrame,
  rules: PipelineRules,
  state: PacketMotionState,
  nowMs: number,
  cellSize: number,
) {
  const { poly, pxPerMs } = hopPolyline(packet, frame, rules, state, cellSize)
  const elapsed = Math.max(0, nowMs - state.syncedAtMs)
  return pointAlong(poly, pxPerMs * elapsed)
}

/** Screen-space center while a packet slides into a machine input (drawn under machines). */
export function packetSinkCenter(sink: PacketSink, rules: PipelineRules, nowMs: number) {
  const tickMs = rules.tickMs > 0 ? rules.tickMs : 250
  const t = Math.min(1, Math.max(0, (nowMs - sink.startedAtMs) / tickMs))
  return {
    px: lerp(sink.startPx, sink.endPx, t),
    py: lerp(sink.startPy, sink.endPy, t),
  }
}