import assert from 'node:assert/strict'
import test from 'node:test'
import { BeltStroke } from '../src/components/game/pipeline/scene/belt-stroke.ts'
import { orthogonalPath, projectStraightEnd } from '../src/components/game/pipeline/scene/grid-math.ts'

test('orthogonalPath fills skipped cells along a straight line', () => {
  assert.deepEqual(orthogonalPath({ x: 0, y: 0 }, { x: 0, y: 0 }), [])
  assert.deepEqual(orthogonalPath({ x: 1, y: 2 }, { x: 4, y: 2 }), [
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 2 },
  ])
})

test('projectStraightEnd snaps to the dominant axis', () => {
  assert.deepEqual(projectStraightEnd({ x: 0, y: 0 }, { x: 0, y: 0 }), { x: 0, y: 0 })
  assert.deepEqual(projectStraightEnd({ x: 0, y: 0 }, { x: 3, y: 1 }), { x: 3, y: 0 })
  assert.deepEqual(projectStraightEnd({ x: 0, y: 0 }, { x: 1, y: 3 }), { x: 0, y: 3 })
})

test('BeltStroke spans a straight line when the pointer skips cells', () => {
  const stroke = new BeltStroke()
  stroke.push({ x: 0, y: 0 })
  stroke.push({ x: 0, y: 3 })
  assert.deepEqual(
    stroke.cells.map((cell) => ({ x: cell.x, y: cell.y, direction: cell.direction })),
    [
      { x: 0, y: 0, direction: 'south' },
      { x: 0, y: 1, direction: 'south' },
      { x: 0, y: 2, direction: 'south' },
      { x: 0, y: 3, direction: 'south' },
    ],
  )
})

test('BeltStroke stays axis-aligned instead of freeform', () => {
  const stroke = new BeltStroke()
  stroke.push({ x: 0, y: 0 })
  stroke.push({ x: 2, y: 1 })
  stroke.push({ x: 3, y: 2 })
  assert.deepEqual(
    stroke.cells.map((cell) => ({ x: cell.x, y: cell.y, direction: cell.direction })),
    [
      { x: 0, y: 0, direction: 'east' },
      { x: 1, y: 0, direction: 'east' },
      { x: 2, y: 0, direction: 'east' },
      { x: 3, y: 0, direction: 'east' },
    ],
  )
})

test('BeltStroke can shorten and switch axis from the origin', () => {
  const stroke = new BeltStroke()
  stroke.push({ x: 2, y: 2 })
  stroke.push({ x: 5, y: 2 })
  stroke.push({ x: 2, y: 0 })
  assert.deepEqual(
    stroke.cells.map((cell) => ({ x: cell.x, y: cell.y, direction: cell.direction })),
    [
      { x: 2, y: 2, direction: 'north' },
      { x: 2, y: 1, direction: 'north' },
      { x: 2, y: 0, direction: 'north' },
    ],
  )
})
