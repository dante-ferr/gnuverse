import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPiece, selectedPiece } from '../src/components/game/model/block-catalog.ts'

test('a column is the beam preset stood at 90°', () => {
  assert.deepEqual(applyPiece('column', { kind: 'square', angle: 20 }), {
    kind: 'wide',
    angle: 90,
  })
  assert.equal(selectedPiece('wide', 90), 'column')
  assert.equal(selectedPiece('wide', -90), 'column')
  assert.deepEqual(applyPiece('wide', { kind: 'wide', angle: 90 }), {
    kind: 'wide',
    angle: 0,
  })
  assert.deepEqual(applyPiece('wide', { kind: 'square', angle: 20 }), {
    kind: 'wide',
    angle: 20,
  })
  assert.equal(selectedPiece('wide', 20), 'wide')
})
