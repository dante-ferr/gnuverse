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
  /** Geometry stamp for `beltByCell`. Updates when belts change without a new tick. */
  layoutStamp: number
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
    layoutStamp: -1,
  }
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
  state.sinks = state.sinks.filter((sink) => nowMs - sink.startedAtMs < tickMs)

  const stamp = beltLayoutStamp(frame.belts)
  if (stamp !== state.layoutStamp) {
    state.beltByCell = indexBelts(frame)
    state.layoutStamp = stamp
    state.paths = new Map()
  }

  if (frame.tick === state.lastTick) return

  const nextIds = new Set(frame.packets.map((packet) => packet.id))
  const maxHop = Math.max(rules.beltSpeedFast, 1)

  for (const [id, prev] of state.at) {
    if (nextIds.has(id)) continue
    const dest = findInputAlongBelt(frame, prev, state.beltByCell, maxHop)
    if (!dest) continue

    const ghostFrame: PipelineFrame = {
      ...frame,
      packets: [{ id, x: prev.x, y: prev.y, shape: prev.shape }],
    }
    const start = packetDisplayCenter({ id, x: prev.x, y: prev.y }, ghostFrame, rules, state, nowMs, cellSize)
    const end = cellCenter(dest.x, dest.y, cellSize)
    state.sinks.push({
      id,
      shape: prev.shape,
      startPx: start.px,
      startPy: start.py,
      endPx: end.px,
      endPy: end.py,
      startedAtMs: nowMs,
    })
  }

  state.paths = new Map()
  const nextFrom = new Map<string, { x: number; y: number }>()
  for (const packet of frame.packets) {
    const prev = state.at.get(packet.id)
    nextFrom.set(
      packet.id,
      prev ?? spawnOrigin(frame, packet.x, packet.y, state.beltByCell, maxHop),
    )
  }
  state.from = nextFrom
  state.at = new Map(
    frame.packets.map((packet) => [packet.id, { x: packet.x, y: packet.y, shape: packet.shape }]),
  )
  state.lastTick = frame.tick
  state.syncedAtMs = nowMs
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

/** Cells a packet may paint in this tick: the belt walk, plus late-frame coast cells. */
export function packetClipCells(
  packet: { id: string; x: number; y: number },
  state: PacketMotionState,
) {
  const path = state.paths.get(packet.id)
  const cells = path && path.length > 0 ? path.slice() : [{ x: packet.x, y: packet.y }]
  const belt = state.beltByCell.get(`${packet.x},${packet.y}`)
  if (!belt) return cells
  let cell = { x: packet.x, y: packet.y }
  const coastSteps = Math.max(1, belt.speed ?? 1)
  for (let i = 0; i < coastSteps; i++) {
    const here = state.beltByCell.get(`${cell.x},${cell.y}`)
    if (!here) break
    cell = ahead(cell.x, cell.y, here.direction)
    const last = cells[cells.length - 1]!
    if (last.x !== cell.x || last.y !== cell.y) cells.push(cell)
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

/** Arc-length lerp along cell-center waypoints (stays on the L through corners). */
function lerpAlongCells(
  cells: { x: number; y: number }[],
  t: number,
  cellSize: number,
): { px: number; py: number } {
  if (cells.length === 0) return { px: 0, py: 0 }
  if (cells.length === 1) return cellCenter(cells[0]!.x, cells[0]!.y, cellSize)
  const points = cells.map((cell) => cellCenter(cell.x, cell.y, cellSize))
  const lengths: number[] = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const len = Math.hypot(b.px - a.px, b.py - a.py)
    lengths.push(len)
    total += len
  }
  if (total < 1e-6) return points[points.length - 1]!
  const clamped = Math.min(1, Math.max(0, t))
  let remain = clamped * total
  for (let i = 0; i < lengths.length; i++) {
    const seg = lengths[i]!
    const a = points[i]!
    const b = points[i + 1]!
    if (remain <= seg || i === lengths.length - 1) {
      const u = seg < 1e-6 ? 1 : Math.min(1, remain / seg)
      return { px: lerp(a.px, b.px, u), py: lerp(a.py, b.py, u) }
    }
    remain -= seg
  }
  return points[points.length - 1]!
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

/** Screen-space center for a packet, interpolated between server ticks (and optionally coasting on the belt). */
export function packetDisplayCenter(
  packet: { id: string; x: number; y: number; shape?: string },
  frame: PipelineFrame,
  rules: PipelineRules,
  state: PacketMotionState,
  nowMs: number,
  cellSize: number,
) {
  const to = { x: packet.x, y: packet.y }
  const from = state.from.get(packet.id) ?? to
  const tickMs = rules.tickMs > 0 ? rules.tickMs : 250
  const elapsed = Math.max(0, nowMs - state.syncedAtMs)
  const tickPhase = elapsed / tickMs

  const maxSteps = Math.max(rules.beltSpeedFast, 1) + 2
  if (!state.paths.has(packet.id)) {
    state.paths.set(packet.id, findBeltPath(frame, from, to, maxSteps, state.beltByCell) ?? [])
  }
  const path = state.paths.get(packet.id)
  const hopCells =
    path && path.length >= 2
      ? path.length - 1
      : sameCell(from, to)
        ? 0
        : Math.max(1, Math.abs(to.x - from.x) + Math.abs(to.y - from.y))
  const speed = hopBeltSpeed(frame, path, to, state.beltByCell)
  // Cover `hopCells` at `speed` cells/tick — short hops on fast belts finish early and hold.
  const hopDurationMs = hopCells > 0 ? (tickMs * hopCells) / speed : 0
  const hopPhase = hopDurationMs > 0 ? elapsed / hopDurationMs : 1

  if (hopPhase < 1) {
    if (path && path.length >= 2) return lerpAlongCells(path, hopPhase, cellSize)
    const a = cellCenter(from.x, from.y, cellSize)
    const b = cellCenter(to.x, to.y, cellSize)
    return { px: lerp(a.px, b.px, hopPhase), py: lerp(a.py, b.py, hopPhase) }
  }

  const belt = beltAt(frame, to.x, to.y, state.beltByCell)
  if (!belt) {
    return cellCenter(to.x, to.y, cellSize)
  }

  // Coast only after the next tick is late — advance at this belt's speed.
  const late = Math.max(0, tickPhase - 1)
  if (late <= 0) {
    return cellCenter(to.x, to.y, cellSize)
  }

  const coastSpeed = Math.max(1, belt.speed ?? 1)
  const coastCells = Math.min(coastSpeed, late * coastSpeed)
  return lerpAlongBelt(frame, to, coastCells, cellSize, state.beltByCell)
}

/** Walk `distance` cells along outbound belts from `start` (fractional OK). */
function lerpAlongBelt(
  frame: PipelineFrame,
  start: { x: number; y: number },
  distance: number,
  cellSize: number,
  belts?: Map<string, BeltRecord>,
) {
  if (distance <= 0) return cellCenter(start.x, start.y, cellSize)
  const cells: { x: number; y: number }[] = [start]
  let cell = start
  const steps = Math.max(1, Math.ceil(distance))
  for (let i = 0; i < steps; i++) {
    const belt = beltAt(frame, cell.x, cell.y, belts)
    if (!belt) break
    cell = ahead(cell.x, cell.y, belt.direction)
    cells.push(cell)
  }
  if (cells.length < 2) return cellCenter(start.x, start.y, cellSize)
  const t = Math.min(1, distance / (cells.length - 1))
  return lerpAlongCells(cells, t, cellSize)
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