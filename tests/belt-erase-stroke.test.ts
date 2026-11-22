import assert from 'node:assert/strict'
import test from 'node:test'
import { BeltEraseStroke } from '../src/components/game/pipeline/scene/belt-erase-stroke.ts'

test('BeltEraseStroke fills the axis-aligned rectangle between origin and end', () => {
  const stroke = new BeltEraseStroke()
  assert.equal(stroke.push({ x: 2, y: 3 }), true)
  assert.deepEqual(stroke.cells(), [{ x: 2, y: 3 }])
  assert.equal(stroke.push({ x: 4, y: 1 }), true)
  assert.deepEqual(stroke.bounds(), { minX: 2, maxX: 4, minY: 1, maxY: 3 })
  assert.deepEqual(stroke.cells(), [
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 2 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 4, y: 3 },
  ])
})

test('BeltEraseStroke ignores duplicate end cells', () => {
  const stroke = new BeltEraseStroke()
  stroke.push({ x: 0, y: 0 })
  assert.equal(stroke.push({ x: 1, y: 1 }), true)
  assert.equal(stroke.push({ x: 1, y: 1 }), false)
})
