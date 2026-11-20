import { ahead, opposite } from '../../../../../game-server/pipeline/geometry/direction.ts'
import { CombinerMachine } from '../../../../../game-server/pipeline/machines/combiner-machine.ts'
import { SplitterMachine } from '../../../../../game-server/pipeline/machines/splitter-machine.ts'
import { TunnelPortalMachine } from '../../../../../game-server/pipeline/machines/tunnel-machine.ts'
import { CoreMachine } from '../../../../../game-server/pipeline/machines/core-machine.ts'
import { SourceMachine } from '../../../../../game-server/pipeline/machines/source-machine.ts'
import type { PipelineFrame, PipelineRules } from '../model/frame.ts'

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
}

export function createPacketMotionState(): PacketMotionState {
  return { lastTick: -1, syncedAtMs: 0, from: new Map(), at: new Map(), sinks: [] }
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

  if (frame.tick === state.lastTick) return

  const nextIds = new Set(frame.packets.map((packet) => packet.id))

  for (const [id, prev] of state.at) {
    if (nextIds.has(id)) continue
    const belt = beltAt(frame, prev.x, prev.y)
    if (!belt) continue
    const dest = ahead(prev.x, prev.y, belt.direction)
    if (!isMachineInputCell(frame, dest)) continue

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

  const nextFrom = new Map<string, { x: number; y: number }>()
  for (const packet of frame.packets) {
    const prev = state.at.get(packet.id)
    nextFrom.set(packet.id, prev ?? spawnOrigin(frame, packet.x, packet.y))
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
 */
function spawnOrigin(frame: PipelineFrame, x: number, y: number) {
  const fromPort = outputPortOrigin(frame, x, y)
  if (fromPort) return fromPort
  const belt = beltAt(frame, x, y)
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

function beltAt(frame: PipelineFrame, x: number, y: number) {
  return frame.belts.find((belt) => belt.x === x && belt.y === y)
}

/** True when `cell` is an input slot that can absorb a packet (core, craft, splitter, tunnel). */
function isMachineInputCell(frame: PipelineFrame, cell: { x: number; y: number }) {
  const cores = frame.cores?.length
    ? frame.cores
    : [{ id: frame.core.id, x: frame.core.x, y: frame.core.y }]
  for (const spec of cores) {
    const core = new CoreMachine(spec.id, { x: spec.x, y: spec.y })
    if (core.slotAt(cell, 'input')) return true
  }
  for (const spec of frame.combiners ?? []) {
    const machine = new CombinerMachine(
      spec.id,
      spec.machineId,
      { x: spec.x, y: spec.y },
      spec.facing,
    )
    if (machine.slotAt(cell, 'input')) return true
  }
  for (const spec of frame.splitters ?? []) {
    const machine = new SplitterMachine(
      spec.id,
      { x: spec.x, y: spec.y },
      spec.facing,
      { id: '', nickname: '' },
    )
    if (machine.slotAt(cell, 'input')) return true
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
    if (portal.slotAt(cell, 'input')) return true
  }
  return false
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
): { x: number; y: number }[] | null {
  if (sameCell(from, to)) return [from]
  type Node = { cell: { x: number; y: number }; path: { x: number; y: number }[] }
  const queue: Node[] = [{ cell: from, path: [from] }]
  const seen = new Set([cellKey(from)])
  while (queue.length > 0) {
    const { cell, path } = queue.shift()!
    if (path.length > maxSteps + 1) continue
    const belt = beltAt(frame, cell.x, cell.y)
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
  const phase = elapsed / tickMs

  if (phase < 1) {
    const maxSteps = Math.max(rules.beltSpeedFast, 1) + 2
    const path = findBeltPath(frame, from, to, maxSteps)
    if (path && path.length >= 2) return lerpAlongCells(path, phase, cellSize)
    const a = cellCenter(from.x, from.y, cellSize)
    const b = cellCenter(to.x, to.y, cellSize)
    return { px: lerp(a.px, b.px, phase), py: lerp(a.py, b.py, phase) }
  }

  const belt = beltAt(frame, to.x, to.y)
  if (!belt) {
    return cellCenter(to.x, to.y, cellSize)
  }

  const coast = Math.min(1, phase - 1)
  if (coast <= 0) {
    return cellCenter(to.x, to.y, cellSize)
  }

  const next = ahead(to.x, to.y, belt.direction)
  const a = cellCenter(to.x, to.y, cellSize)
  const b = cellCenter(next.x, next.y, cellSize)
  return { px: lerp(a.px, b.px, coast), py: lerp(a.py, b.py, coast) }
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