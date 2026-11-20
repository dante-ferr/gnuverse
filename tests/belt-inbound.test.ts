import assert from 'node:assert/strict'
import test from 'node:test'
import {
  directionFromInboundBelts,
  resolveBeltPlaceDirection,
} from '../src/components/game/pipeline/belt-inbound.ts'
import {
  getBeltPlaceDirection,
  setBeltPlaceDirection,
} from '../src/components/game/pipeline/belt-place-options.ts'

test('directionFromInboundBelts copies a single feeder facing and ignores concurrency', () => {
  assert.equal(directionFromInboundBelts({ x: 2, y: 2 }, []), null)

  assert.equal(
    directionFromInboundBelts({ x: 2, y: 2 }, [{ x: 2, y: 1, direction: 'south' }]),
    'south',
  )
  assert.equal(
    directionFromInboundBelts({ x: 2, y: 2 }, [{ x: 1, y: 2, direction: 'east' }]),
    'east',
  )

  // More than one inbound feeder: no adjacency influence.
  assert.equal(
    directionFromInboundBelts(
      { x: 2, y: 2 },
      [
        { x: 3, y: 2, direction: 'west' },
        { x: 2, y: 1, direction: 'south' },
      ],
    ),
    null,
  )

  // Neighbor that does not point into the cell is ignored.
  assert.equal(
    directionFromInboundBelts({ x: 2, y: 2 }, [{ x: 2, y: 1, direction: 'north' }]),
    null,
  )
})

test('resolveBeltPlaceDirection falls back to the Girar facing without mutating it', () => {
  const previous = getBeltPlaceDirection()
  setBeltPlaceDirection('west')
  try {
    assert.equal(resolveBeltPlaceDirection({ x: 0, y: 0 }, []), 'west')
    assert.equal(
      resolveBeltPlaceDirection({ x: 0, y: 0 }, [{ x: 0, y: -1, direction: 'south' }]),
      'south',
    )
    assert.equal(getBeltPlaceDirection(), 'west')
  } finally {
    setBeltPlaceDirection(previous)
  }
})
