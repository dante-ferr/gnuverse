import assert from 'node:assert/strict'
import test from 'node:test'
import {
  sourceIsExporting,
  sourceOutputCell,
} from '../src/components/game/pipeline/scene/source-exporting.ts'
import { createPacketMotionState } from '../src/components/game/pipeline/scene/packet-motion.ts'

const sourceSpec = {
  id: 'src',
  x: 0,
  y: 0,
  direction: 'east' as const,
  shape: 'circle',
}

test('sourceOutputCell is one cell east of the rim', () => {
  const out = sourceOutputCell(sourceSpec)
  assert.deepEqual(out, { x: 3, y: 1 })
})

test('sourceIsExporting when packet moves from inside onto output', () => {
  const motion = createPacketMotionState()
  const out = sourceOutputCell(sourceSpec)
  motion.at.set('p1', { x: out.x, y: out.y, shape: 'circle' })
  motion.from.set('p1', { x: 2, y: 1 })
  assert.equal(sourceIsExporting(out, motion), true)
})

test('sourceIsExporting when packet just left output', () => {
  const motion = createPacketMotionState()
  const out = sourceOutputCell(sourceSpec)
  motion.at.set('p1', { x: out.x + 1, y: out.y, shape: 'circle' })
  motion.from.set('p1', { x: out.x, y: out.y })
  assert.equal(sourceIsExporting(out, motion), true)
})

test('sourceIsExporting false for jammed packet on output', () => {
  const motion = createPacketMotionState()
  const out = sourceOutputCell(sourceSpec)
  motion.at.set('p1', { x: out.x, y: out.y, shape: 'circle' })
  motion.from.set('p1', { x: out.x, y: out.y })
  assert.equal(sourceIsExporting(out, motion), false)
})

test('sourceIsExporting false with no packets', () => {
  const motion = createPacketMotionState()
  const out = sourceOutputCell(sourceSpec)
  assert.equal(sourceIsExporting(out, motion), false)
})