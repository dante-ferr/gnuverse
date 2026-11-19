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

const rules: PipelineRules = testPipelineRules({ coreDemandCircle: 5 })

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

  const start = packetDisplayCenter({ id: 'p1', x: 3, y: 2, shape: 'circle' }, f1, rules, motion, 1000, cell)
  const mid = packetDisplayCenter({ id: 'p1', x: 3, y: 2, shape: 'circle' }, f1, rules, motion, 1125, cell)
  const end = packetDisplayCenter({ id: 'p1', x: 3, y: 2, shape: 'circle' }, f1, rules, motion, 1250, cell)

  assert.equal(start.px, (2.5 * cell))
  assert.equal(end.px, (3.5 * cell))
  assert.equal(mid.px, (3 * cell))
})

test('packetDisplayCenter coasts along belt after one tickMs', () => {
  const motion = createPacketMotionState()
  const f = frame(3, [{ id: 'p1', x: 2, y: 2, shape: 'circle' }])
  syncPacketMotion(motion, f, rules, 0, cell)

  const settled = packetDisplayCenter({ id: 'p1', x: 2, y: 2, shape: 'circle' }, f, rules, motion, 250, cell)
  const coastMid = packetDisplayCenter({ id: 'p1', x: 2, y: 2, shape: 'circle' }, f, rules, motion, 375, cell)

  assert.equal(settled.px, 2.5 * cell)
  assert.equal(coastMid.px, 3 * cell)
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