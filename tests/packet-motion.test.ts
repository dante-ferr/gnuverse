import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPacketMotionState,
  packetDisplayCenter,
  syncPacketMotion,
} from '../src/components/game/pipeline/scene/packet-motion.ts'
import type { PipelineFrame, PipelineRules } from '../src/components/game/pipeline/model/frame.ts'

const rules: PipelineRules = {
  tickMs: 250,
  gridWidth: 24,
  gridHeight: 24,
  sourcePeriodTicks: 4,
  colorBackground: '#0e171d',
  colorGrid: '#23343c',
  colorBelt: '#9eb0b7',
  colorBeltChevron: '#6b7d87',
  colorPacket: '#52d6c9',
  colorCore: '#ffffff',
  colorSource: '#52d6c9',
  colorAccent: '#52d6c9',
  colorDecor: '#1a4542',
  decorDarkenPercent: 35,
  outlineWidthPx: 3,
  colorOutline: '#0a1014',
  colorSurface: '#17252c',
  colorMuted: '#6a7b83',
  colorHighlight: '#86e7dd',
  colorWarning: '#ff8b7d',
  colorSuccess: '#5ed4b0',
  colorInk: '#293c45',
  decorStrokeWidth: 28,
  resourceGlyphSizePx: 28,
  resourceGlyphOrbitPx: 4,
  resourceGlyphOrbitMs: 4000,
  beltChevronStrokePx: 4,
  beltChevronFlowMs: 900,
  machineClearanceMin: 1,
  coreClearanceExtra: 2,
  coreDemandCircle: 5,
  chunkSize: 24,
  mapChunkExtent: 64,
  chunkCostBase: 5,
  chunkCostGrowth: 2,
  chunkPreviewRing: 1,
  slotInputDepthPercent: 22,
  slotOutputDepthPercent: 34,
  slotBracketThickPercent: 18,
  slotFlowMarkDepthPercent: 12,
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
  syncPacketMotion(motion, f0, 1000)
  const f1 = frame(1, [{ id: 'p1', x: 3, y: 2, shape: 'circle' }])
  syncPacketMotion(motion, f1, 1000)

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
  syncPacketMotion(motion, f, 0)

  const settled = packetDisplayCenter({ id: 'p1', x: 2, y: 2, shape: 'circle' }, f, rules, motion, 250, cell)
  const coastMid = packetDisplayCenter({ id: 'p1', x: 2, y: 2, shape: 'circle' }, f, rules, motion, 375, cell)

  assert.equal(settled.px, 2.5 * cell)
  assert.equal(coastMid.px, 3 * cell)
})