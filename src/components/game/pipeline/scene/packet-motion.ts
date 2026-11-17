import { ahead, opposite } from '../../../../../game-server/pipeline/geometry/direction.ts'
import type { PipelineFrame, PipelineRules } from '../model/frame.ts'

export type PacketMotionState = {
  lastTick: number
  syncedAtMs: number
  /** Cell at the previous server tick (lerp start for the step that just completed). */
  from: Map<string, { x: number; y: number }>
  /** Authoritative cells after the latest frame event. */
  at: Map<string, { x: number; y: number }>
}

export function createPacketMotionState(): PacketMotionState {
  return { lastTick: -1, syncedAtMs: 0, from: new Map(), at: new Map() }
}

/** Call once per paint when the pipeline frame tick advances (or on first frame). */
export function syncPacketMotion(state: PacketMotionState, frame: PipelineFrame, nowMs: number) {
  if (frame.tick === state.lastTick) return
  const nextFrom = new Map<string, { x: number; y: number }>()
  for (const packet of frame.packets) {
    const prev = state.at.get(packet.id)
    nextFrom.set(packet.id, prev ?? spawnOrigin(frame, packet.x, packet.y))
  }
  state.from = nextFrom
  state.at = new Map(frame.packets.map((packet) => [packet.id, { x: packet.x, y: packet.y }]))
  state.lastTick = frame.tick
  state.syncedAtMs = nowMs
}

function spawnOrigin(frame: PipelineFrame, x: number, y: number) {
  const belt = beltAt(frame, x, y)
  if (!belt) return { x, y }
  return ahead(x, y, opposite(belt.direction))
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
  packet: { id: string; x: number; y: number },
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