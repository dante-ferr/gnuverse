import { ahead, opposite } from '../../../../../game-server/pipeline/geometry/direction.ts'
import { CombinerMachine } from '../../../../../game-server/pipeline/machines/combiner-machine.ts'
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
  /** Packets consumed by the core, animating under the machine body. */
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
  const core = new CoreMachine(frame.core.id, { x: frame.core.x, y: frame.core.y })

  for (const [id, prev] of state.at) {
    if (nextIds.has(id)) continue
    const belt = beltAt(frame, prev.x, prev.y)
    if (!belt) continue
    const dest = ahead(prev.x, prev.y, belt.direction)
    if (!core.slotAt(dest, 'input')) continue

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
      spec.recipeId,
      { x: spec.x, y: spec.y },
      spec.facing,
    )
    const slot = machine.slotAt(cell, 'output')
    if (slot) return ahead(x, y, opposite(slot.travel))
  }
  return null
}

function beltAt(frame: PipelineFrame, x: number, y: number) {
  return frame.belts.find((belt) => belt.x === x && belt.y === y)
}

function cellCenter(x: number, y: number, cellSize: number) {
  return { px: (x + 0.5) * cellSize, py: (y + 0.5) * cellSize }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
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

/** Screen-space center while a delivered packet slides into a core input (drawn under machines). */
export function packetSinkCenter(sink: PacketSink, rules: PipelineRules, nowMs: number) {
  const tickMs = rules.tickMs > 0 ? rules.tickMs : 250
  const t = Math.min(1, Math.max(0, (nowMs - sink.startedAtMs) / tickMs))
  return {
    px: lerp(sink.startPx, sink.endPx, t),
    py: lerp(sink.startPy, sink.endPy, t),
  }
}