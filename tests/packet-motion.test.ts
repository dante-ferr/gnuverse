import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPacketMotionState,
  packetDisplayCenter,
  packetSinkCenter,
  syncPacketMotion,
} from '../src/components/game/pipeline/scene/packet-motion.ts'
import type { PipelineFrame, PipelineRules } from '../src/components/game/pipeline/model/frame.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

const baseRules = testPipelineRules()
const rules: PipelineRules = {
  ...baseRules,
  elements: { ...baseRules.elements, defaultDemandRequired: 5 },
}

function frame(tick: number, packets: PipelineFrame['packets']): PipelineFrame {
  return {
    kind: 'pipeline',
    version: '0.1',
    seed: 'seed',
    width: 24,
    height: 24,
    tick,
    deliveries: 0,
    deliveryByShape: {},
    demands: [{ shape: 'circle', received: 0, required: 5 }],
    collaborators: [],
    belts: [{ id: 'b0', x: 2, y: 2, direction: 'east', authorId: 'a', authorNickname: 'n', placedAt: 0 }],
    packets,
    source: { id: 'source', x: 0, y: 0, direction: 'east', shape: 'circle' },
    core: { id: 'core', x: 10, y: 10 },
  }
}

const cell = 32

test('packetDisplayCenter lerps between ticks', () => {
  const motion = createPacketMotionState()
  const f0 = frame(0, [{ id: 'p1', x: 2, y: 2, shape: 'circle' }])
  syncPacketMotion(motion, f0, rules, 1000, cell)
  const f1 = frame(1, [{ id: 'p1', x: 3, y: 2, shape: 'circle' }])
  syncPacketMotion(motion, f1, rules, 1000, cell)

  const start = packetDisplayCenter({ id: 'p1', x: 3, y: 2 }, f1, rules, motion, 1000, cell)
  const mid = packetDisplayCenter({ id: 'p1', x: 3, y: 2 }, f1, rules, motion, 1125, cell)
  const end = packetDisplayCenter({ id: 'p1', x: 3, y: 2 }, f1, rules, motion, 1250, cell)

  assert.equal(start.px, (2.5 * cell))
  assert.equal(end.px, (3.5 * cell))
  assert.equal(mid.px, (3 * cell))
})

test('packetDisplayCenter holds on the cell when the next tick is late', () => {
  const motion = createPacketMotionState()
  const f = frame(3, [{ id: 'p1', x: 2, y: 2, shape: 'circle' }])
  syncPacketMotion(motion, f, rules, 0, cell)

  const settled = packetDisplayCenter({ id: 'p1', x: 2, y: 2, shape: 'circle' }, f, rules, motion, 250, cell)
  const late = packetDisplayCenter({ id: 'p1', x: 2, y: 2, shape: 'circle' }, f, rules, motion, 375, cell)

  assert.equal(settled.px, 2.5 * cell)
  assert.equal(late.px, 2.5 * cell)
})

test('packetDisplayCenter does not rewind when a late tick arrives', () => {
  const motion = createPacketMotionState()
  const belts = [0, 1, 2].map((x) => ({
    id: `b${x}`,
    x,
    y: 2,
    direction: 'east' as const,
    authorId: 'a',
    authorNickname: 'n',
    placedAt: x,
  }))
  const at = (tick: number, x: number) => {
    const next = frame(tick, [{ id: 'p1', x, y: 2, shape: 'circle' }])
    next.belts = belts
    return next
  }

  syncPacketMotion(motion, at(0, 0), rules, 0, cell)
  syncPacketMotion(motion, at(1, 1), rules, rules.tickMs, cell)
  const held = packetDisplayCenter(
    { id: 'p1', x: 1, y: 2, shape: 'circle' },
    at(1, 1),
    rules,
    motion,
    rules.tickMs * 2,
    cell,
  )
  assert.ok(Math.abs(held.px - 1.5 * cell) < 1e-6)

  syncPacketMotion(motion, at(2, 2), rules, rules.tickMs * 2 + 100, cell)
  const resumed = packetDisplayCenter(
    { id: 'p1', x: 2, y: 2, shape: 'circle' },
    at(2, 2),
    rules,
    motion,
    rules.tickMs * 2 + 100,
    cell,
  )
  assert.ok(Math.abs(resumed.px - held.px) < 1e-6)
  const advanced = packetDisplayCenter(
    { id: 'p1', x: 2, y: 2, shape: 'circle' },
    at(2, 2),
    rules,
    motion,
    rules.tickMs * 2 + 200,
    cell,
  )
  assert.ok(advanced.px > resumed.px)
})

test('packetDisplayCenter continues from the on-screen point when the next tick arrives early', () => {
  const motion = createPacketMotionState()
  const belts = [0, 1, 2, 3].map((x) => ({
    id: `b${x}`,
    x,
    y: 2,
    direction: 'east' as const,
    authorId: 'a',
    authorNickname: 'n',
    placedAt: x,
  }))
  const at = (tick: number, x: number) => {
    const next = frame(tick, [{ id: 'p1', x, y: 2, shape: 'circle' }])
    next.belts = belts
    return next
  }

  syncPacketMotion(motion, at(0, 0), rules, 0, cell)
  syncPacketMotion(motion, at(1, 1), rules, 250, cell)
  const before = packetDisplayCenter({ id: 'p1', x: 1, y: 2, shape: 'circle' }, at(1, 1), rules, motion, 400, cell)
  // 150ms of a 250ms hop from cell 0 to cell 1 → 0.6 cell past the start center.
  assert.ok(Math.abs(before.px - (0.5 + 0.6) * cell) < 1e-6)

  syncPacketMotion(motion, at(2, 2), rules, 400, cell)
  const atTick = packetDisplayCenter({ id: 'p1', x: 2, y: 2, shape: 'circle' }, at(2, 2), rules, motion, 400, cell)
  assert.ok(Math.abs(atTick.px - before.px) < 1e-6)
  assert.ok(Math.abs(atTick.py - 2.5 * cell) < 1e-6)

  const later = packetDisplayCenter({ id: 'p1', x: 2, y: 2, shape: 'circle' }, at(2, 2), rules, motion, 500, cell)
  assert.ok(later.px > atTick.px)
  assert.ok(later.px < 2.5 * cell)
})

test('packetDisplayCenter follows an L-shaped multi-hop path instead of cutting the corner', () => {
  const motion = createPacketMotionState()
  const fast = rules.beltSpeedFast
  const belts = [
    { id: 'b0', x: 0, y: 0, direction: 'east' as const, authorId: 'a', authorNickname: 'n', placedAt: 0, speed: fast },
    { id: 'b1', x: 1, y: 0, direction: 'east' as const, authorId: 'a', authorNickname: 'n', placedAt: 1, speed: fast },
    { id: 'b2', x: 2, y: 0, direction: 'north' as const, authorId: 'a', authorNickname: 'n', placedAt: 2, speed: fast },
    { id: 'b3', x: 2, y: -1, direction: 'north' as const, authorId: 'a', authorNickname: 'n', placedAt: 3, speed: fast },
  ]
  const f0 = frame(0, [{ id: 'p1', x: 0, y: 0, shape: 'circle' }])
  f0.belts = belts
  syncPacketMotion(motion, f0, rules, 1000, cell)

  // One tick on a fast line: (0,0) → (1,0) → (2,0) → (2,-1)
  const f1 = frame(1, [{ id: 'p1', x: 2, y: -1, shape: 'circle' }])
  f1.belts = belts
  syncPacketMotion(motion, f1, rules, 1000, cell)

  const mid = packetDisplayCenter({ id: 'p1', x: 2, y: -1, shape: 'circle' }, f1, rules, motion, 1125, cell)
  // Three equal segments; halfway is mid-edge on the approach into the corner (still on the L).
  assert.equal(mid.px, 2 * cell)
  assert.equal(mid.py, 0.5 * cell)

  // Straight diagonal from start→end would leave the track (y drifts north early).
  const diagonalPy = (0.5 * cell + -0.5 * cell) / 2
  assert.notEqual(mid.py, diagonalPy)
})

test('packetDisplayCenter exits onto a fast belt at belt speed, not a full-tick crawl', () => {
  const motion = createPacketMotionState()
  const fast = rules.beltSpeedFast
  // Source at (0,0) facing east → output (3,1). Fast belt continues east.
  const belts = [
    { id: 'b0', x: 3, y: 1, direction: 'east' as const, authorId: 'a', authorNickname: 'n', placedAt: 0, speed: fast },
    { id: 'b1', x: 4, y: 1, direction: 'east' as const, authorId: 'a', authorNickname: 'n', placedAt: 1, speed: fast },
    { id: 'b2', x: 5, y: 1, direction: 'east' as const, authorId: 'a', authorNickname: 'n', placedAt: 2, speed: fast },
  ]
  const f = frame(1, [{ id: 'p1', x: 3, y: 1, shape: 'circle' }])
  f.belts = belts
  f.source = { id: 'source', x: 0, y: 0, direction: 'east', shape: 'circle' }
  syncPacketMotion(motion, f, rules, 1000, cell)

  // One-cell port→belt hop on a speed-3 belt finishes in tickMs/3, then holds.
  const afterSubtick = packetDisplayCenter(
    { id: 'p1', x: 3, y: 1, shape: 'circle' },
    f,
    rules,
    motion,
    1000 + rules.tickMs / fast,
    cell,
  )
  assert.ok(Math.abs(afterSubtick.px - 3.5 * cell) < 1e-6)
  assert.ok(Math.abs(afterSubtick.py - 1.5 * cell) < 1e-6)

  const midTick = packetDisplayCenter(
    { id: 'p1', x: 3, y: 1, shape: 'circle' },
    f,
    rules,
    motion,
    1000 + rules.tickMs / 2,
    cell,
  )
  assert.ok(Math.abs(midTick.px - 3.5 * cell) < 1e-6)
  assert.ok(Math.abs(midTick.py - 1.5 * cell) < 1e-6)
})

test('spawnOrigin reaches upstream machine port after same-tick fast multi-hop', () => {
  const motion = createPacketMotionState()
  const fast = rules.beltSpeedFast
  // Tunnel exit at (5,2) facing east; packet already two cells downstream.
  const tunnels = [
    {
      id: 't1:in',
      pairId: 't1',
      role: 'entrance' as const,
      x: 0,
      y: 2,
      direction: 'east' as const,
      authorId: 'a',
      authorNickname: 'n',
      queue: [null, null],
    },
    {
      id: 't1:out',
      pairId: 't1',
      role: 'exit' as const,
      x: 5,
      y: 2,
      direction: 'east' as const,
      authorId: 'a',
      authorNickname: 'n',
    },
  ]
  const belts = [
    { id: 'b0', x: 5, y: 2, direction: 'east' as const, authorId: 'a', authorNickname: 'n', placedAt: 0, speed: fast },
    { id: 'b1', x: 6, y: 2, direction: 'east' as const, authorId: 'a', authorNickname: 'n', placedAt: 1, speed: fast },
    { id: 'b2', x: 7, y: 2, direction: 'east' as const, authorId: 'a', authorNickname: 'n', placedAt: 2, speed: fast },
  ]
  const f = frame(2, [{ id: 'p1', x: 7, y: 2, shape: 'circle' }])
  f.belts = belts
  f.tunnels = tunnels
  syncPacketMotion(motion, f, rules, 1000, cell)

  const start = packetDisplayCenter({ id: 'p1', x: 7, y: 2, shape: 'circle' }, f, rules, motion, 1000, cell)
  // Exit at (5,2) east → output belt cell (6,2); port origin is the portal (5,2).
  assert.equal(start.px, 5.5 * cell)
  assert.equal(start.py, 2.5 * cell)
})

test('syncPacketMotion sinks a packet absorbed mid-tick on a fast approach', () => {
  const motion = createPacketMotionState()
  const fast = rules.beltSpeedFast
  const core = { id: 'core', x: 10, y: 10 }
  // West face input at (10,12); approach is (11,12). Packet last seen two cells out.
  const belts = [
    { id: 'b0', x: 13, y: 12, direction: 'west' as const, authorId: 'a', authorNickname: 'n', placedAt: 0, speed: fast },
    { id: 'b1', x: 12, y: 12, direction: 'west' as const, authorId: 'a', authorNickname: 'n', placedAt: 1, speed: fast },
    { id: 'b2', x: 11, y: 12, direction: 'west' as const, authorId: 'a', authorNickname: 'n', placedAt: 2, speed: fast },
  ]
  const onBelt = frame(4, [{ id: 'p1', x: 13, y: 12, shape: 'circle' }])
  onBelt.core = core
  onBelt.belts = belts
  syncPacketMotion(motion, onBelt, rules, 1000, cell)

  const delivered = frame(5, [])
  delivered.core = core
  delivered.belts = belts
  syncPacketMotion(motion, delivered, rules, 1000, cell)

  assert.equal(motion.sinks.length, 1)
  const sink = motion.sinks[0]!
  assert.equal(sink.endPx, (10 + 0.5) * cell)
  assert.equal(sink.endPy, (12 + 0.5) * cell)
})

test('spawnOrigin exits the source even when the belt is parallel to the output face', () => {
  const motion = createPacketMotionState()
  // Source at (0,0) facing east → output cell (3,1). Belt runs north along that face.
  const f = frame(1, [{ id: 'p1', x: 3, y: 1, shape: 'circle' }])
  f.belts = [
    { id: 'b0', x: 3, y: 1, direction: 'north', authorId: 'a', authorNickname: 'n', placedAt: 0 },
  ]
  f.source = { id: 'source', x: 0, y: 0, direction: 'east', shape: 'circle' }
  syncPacketMotion(motion, f, rules, 1000, cell)

  const start = packetDisplayCenter({ id: 'p1', x: 3, y: 1, shape: 'circle' }, f, rules, motion, 1000, cell)
  // Machine rim behind the east output is (2,1), not empty air south of the belt (3,2).
  assert.equal(start.px, 2.5 * cell)
  assert.equal(start.py, 1.5 * cell)
})

test('syncPacketMotion starts a sink when a packet is consumed by the core', () => {
  const motion = createPacketMotionState()
  const core = { id: 'core', x: 10, y: 10 }
  const belts = [
    { id: 'b0', x: 11, y: 12, direction: 'west' as const, authorId: 'a', authorNickname: 'n', placedAt: 0 },
  ]
  const onBelt = frame(4, [{ id: 'p1', x: 11, y: 12, shape: 'circle' }])
  onBelt.core = core
  onBelt.belts = belts
  syncPacketMotion(motion, onBelt, rules, 1000, cell)

  const delivered = frame(5, [])
  delivered.core = core
  delivered.belts = belts
  syncPacketMotion(motion, delivered, rules, 1000, cell)

  assert.equal(motion.sinks.length, 1)
  const sink = motion.sinks[0]!
  assert.equal(sink.endPx, (10 + 0.5) * cell)
  assert.equal(sink.endPy, (12 + 0.5) * cell)

  const mid = packetSinkCenter(sink, rules, 1000 + rules.tickMs / 2)
  assert.equal(mid.px, (sink.startPx + sink.endPx) / 2)
})

test('syncPacketMotion starts a sink when a packet enters a tunnel entrance', () => {
  const motion = createPacketMotionState()
  const tunnels = [
    {
      id: 't1:in',
      pairId: 't1',
      role: 'entrance' as const,
      x: 5,
      y: 2,
      direction: 'east' as const,
      authorId: 'a',
      authorNickname: 'n',
      queue: [null, null],
    },
    {
      id: 't1:out',
      pairId: 't1',
      role: 'exit' as const,
      x: 8,
      y: 2,
      direction: 'east' as const,
      authorId: 'a',
      authorNickname: 'n',
    },
  ]
  const belts = [
    { id: 'b0', x: 4, y: 2, direction: 'east' as const, authorId: 'a', authorNickname: 'n', placedAt: 0 },
  ]
  const onBelt = frame(4, [{ id: 'p1', x: 4, y: 2, shape: 'circle' }])
  onBelt.belts = belts
  onBelt.tunnels = tunnels
  syncPacketMotion(motion, onBelt, rules, 1000, cell)

  const absorbed = frame(5, [])
  absorbed.belts = belts
  absorbed.tunnels = tunnels
  syncPacketMotion(motion, absorbed, rules, 1000, cell)

  assert.equal(motion.sinks.length, 1)
  const sink = motion.sinks[0]!
  assert.equal(sink.endPx, (5 + 0.5) * cell)
  assert.equal(sink.endPy, (2 + 0.5) * cell)
  assert.equal(sink.overPortals, undefined)
})

test('gap-0 tunnel pass-through is one sink to the exit belt, not enter plus exit shoots', () => {
  const motion = createPacketMotionState()
  const tunnels = [
    {
      id: 't0:in',
      pairId: 't0',
      role: 'entrance' as const,
      x: 5,
      y: 2,
      direction: 'east' as const,
      authorId: 'a',
      authorNickname: 'n',
      queue: [],
      transit: ['circle'],
    },
    {
      id: 't0:out',
      pairId: 't0',
      role: 'exit' as const,
      x: 6,
      y: 2,
      direction: 'east' as const,
      authorId: 'a',
      authorNickname: 'n',
    },
  ]
  const belts = [
    { id: 'b0', x: 4, y: 2, direction: 'east' as const, authorId: 'a', authorNickname: 'n', placedAt: 0 },
    { id: 'b1', x: 7, y: 2, direction: 'east' as const, authorId: 'a', authorNickname: 'n', placedAt: 0 },
  ]
  const onBelt = frame(4, [{ id: 'p1', x: 4, y: 2, shape: 'circle' }])
  onBelt.belts = belts
  onBelt.tunnels = tunnels.map((portal) =>
    portal.role === 'entrance' ? { ...portal, transit: undefined } : portal,
  )
  syncPacketMotion(motion, onBelt, rules, 1000, cell)

  const passed = frame(5, [{ id: 'p2', x: 7, y: 2, shape: 'circle' }])
  passed.belts = belts
  passed.tunnels = tunnels
  syncPacketMotion(motion, passed, rules, 1250, cell)

  assert.equal(motion.sinks.length, 1)
  const sink = motion.sinks[0]!
  assert.equal(sink.overPortals, true)
  assert.equal(sink.hidesPacketId, 'p2')
  assert.equal(sink.endPx, (7 + 0.5) * cell)
  assert.equal(sink.endPy, (2 + 0.5) * cell)
  assert.deepEqual(motion.from.get('p2'), { x: 7, y: 2 })
})
test('packetDisplayCenter stays in place when a chunk buy shifts the frame origin', () => {
  const motion = createPacketMotionState()
  const shift = rules.chunkSize
  const f0 = frame(0, [{ id: 'p1', x: 2, y: 2, shape: 'circle' }])
  f0.originChunk = { cx: 0, cy: 0 }
  syncPacketMotion(motion, f0, rules, 1000, cell)
  const f1 = frame(1, [{ id: 'p1', x: 3, y: 2, shape: 'circle' }])
  f1.originChunk = { cx: 0, cy: 0 }
  syncPacketMotion(motion, f1, rules, 1000, cell)

  // Chunk bought to the west: origin moves one chunk left, every x grows by chunkSize.
  const shifted = frame(1, [{ id: 'p1', x: 3 + shift, y: 2, shape: 'circle' }])
  shifted.originChunk = { cx: -1, cy: 0 }
  shifted.belts = shifted.belts.map((belt) => ({ ...belt, x: belt.x + shift }))
  syncPacketMotion(motion, shifted, rules, 1125, cell)

  const mid = packetDisplayCenter({ id: 'p1', x: 3 + shift, y: 2 }, shifted, rules, motion, 1125, cell)
  assert.equal(mid.px, (3 + shift) * cell)
  assert.equal(mid.py, 2.5 * cell)

  const f2 = frame(2, [{ id: 'p1', x: 4 + shift, y: 2, shape: 'circle' }])
  f2.originChunk = { cx: -1, cy: 0 }
  f2.belts = shifted.belts
  syncPacketMotion(motion, f2, rules, 1250, cell)
  const start = packetDisplayCenter({ id: 'p1', x: 4 + shift, y: 2 }, f2, rules, motion, 1250, cell)
  assert.ok(Math.abs(start.px - (3.5 + shift) * cell) < cell, `jumped to ${start.px}`)
})
