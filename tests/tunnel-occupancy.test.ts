import assert from 'node:assert/strict'
import test from 'node:test'
import { matchQueueMotion } from '../src/components/game/pipeline/scene/painters/tunnel-occupancy-painter.ts'

test('matchQueueMotion advances FIFO beads and marks new entries from the entrance', () => {
  assert.deepEqual(matchQueueMotion(['circle', null, 'fire', null], [null, 'circle', null, 'fire']), [
    { shape: 'circle', fromIndex: 0, toIndex: 1 },
    { shape: 'fire', fromIndex: 2, toIndex: 3 },
  ])
  assert.deepEqual(matchQueueMotion([null, null, null], ['water', null, null]), [
    { shape: 'water', fromIndex: -1, toIndex: 0 },
  ])
  assert.deepEqual(matchQueueMotion(['circle', null, null, null], [null, null, 'circle', null]), [
    { shape: 'circle', fromIndex: 0, toIndex: 2 },
  ])
})

test('matchQueueMotion keeps an exit flight through the last gap cell', () => {
  assert.deepEqual(matchQueueMotion(['circle', null, null], [null, null, null]), [
    { shape: 'circle', fromIndex: 0, toIndex: 3 },
  ])
  assert.deepEqual(matchQueueMotion([null, null, 'fire'], [null, null, null]), [
    { shape: 'fire', fromIndex: 2, toIndex: 3 },
  ])
})