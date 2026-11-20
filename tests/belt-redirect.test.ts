import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createBeltRedirectSession,
  deriveDirectionFromDrag,
} from '../src/components/game/pipeline/scene/belt-redirect.ts'
import { setBeltCrossQuery, resetBeltCrossQuery } from '../src/components/game/pipeline/scene/belt-cross.ts'

test('deriveDirectionFromDrag uses the dominant axis from the origin', () => {
  assert.equal(deriveDirectionFromDrag({ x: 2, y: 2 }, { x: 2, y: 2 }), null)
  assert.equal(deriveDirectionFromDrag({ x: 2, y: 2 }, { x: 5, y: 3 }), 'east')
  assert.equal(deriveDirectionFromDrag({ x: 2, y: 2 }, { x: 0, y: 3 }), 'west')
  assert.equal(deriveDirectionFromDrag({ x: 2, y: 2 }, { x: 3, y: 5 }), 'south')
  assert.equal(deriveDirectionFromDrag({ x: 2, y: 2 }, { x: 1, y: 0 }), 'north')
})

test('BeltRedirectSession places a stroke along the drag and skips a no-op release', () => {
  setBeltCrossQuery({
    occupancy: () => ({ conveyors: new Set(), blocked: new Set() }),
    maxGap: () => 3,
  })
  try {
    const session = createBeltRedirectSession({ x: 4, y: 4, direction: 'east' })
    assert.equal(session.push({ x: 4, y: 4 }), false)
    assert.deepEqual(session.previewBelts()[0]?.direction, 'east')
    assert.equal(session.finish(), null)

    assert.equal(session.push({ x: 4, y: 1 }), true)
    assert.deepEqual(
      session.previewBelts().map((cell) => ({ x: cell.x, y: cell.y, direction: cell.direction })),
      [
        { x: 4, y: 4, direction: 'north' },
        { x: 4, y: 3, direction: 'north' },
        { x: 4, y: 2, direction: 'north' },
        { x: 4, y: 1, direction: 'north' },
      ],
    )
    assert.deepEqual(session.finish(), {
      structureId: 'belt',
      payload: {
        cells: [
          { x: 4, y: 4, direction: 'north' },
          { x: 4, y: 3, direction: 'north' },
          { x: 4, y: 2, direction: 'north' },
          { x: 4, y: 1, direction: 'north' },
        ],
      },
    })
  } finally {
    resetBeltCrossQuery()
  }
})

test('BeltRedirectSession keeps the new facing when the pointer returns to the origin', () => {
  setBeltCrossQuery({
    occupancy: () => ({ conveyors: new Set(), blocked: new Set() }),
    maxGap: () => 3,
  })
  try {
    const session = createBeltRedirectSession({ x: 0, y: 0, direction: 'south' })
    assert.equal(session.push({ x: 3, y: 0 }), true)
    assert.equal(session.push({ x: 0, y: 0 }), true)
    assert.deepEqual(session.previewBelts(), [
      {
        id: 'redirect-0',
        x: 0,
        y: 0,
        direction: 'east',
        authorId: '',
        authorNickname: '',
        placedAt: 0,
      },
    ])
    assert.deepEqual(session.finish(), {
      structureId: 'belt',
      payload: { cells: [{ x: 0, y: 0, direction: 'east' }] },
    })
  } finally {
    resetBeltCrossQuery()
  }
})

test('BeltRedirectSession tunnels later owned belts and only rewrites the clicked cell', () => {
  setBeltCrossQuery({
    occupancy: () => ({
      conveyors: new Set(['0,0', '1,0', '2,0']),
      blocked: new Set(),
    }),
    maxGap: () => 8,
    belts: () => [
      { x: 0, y: 0, direction: 'south', authorId: 'me' },
      { x: 1, y: 0, direction: 'east', authorId: 'me' },
      { x: 2, y: 0, direction: 'east', authorId: 'me' },
    ],
  })
  try {
    const session = createBeltRedirectSession({ x: 0, y: 0, direction: 'south', authorId: 'me' })
    assert.equal(session.push({ x: 6, y: 0 }), true)
    assert.deepEqual(session.finish()?.payload, {
      cells: [
        { x: 0, y: 0, direction: 'east' },
        { x: 4, y: 0, direction: 'east' },
        { x: 5, y: 0, direction: 'east' },
        { x: 6, y: 0, direction: 'east' },
      ],
      tunnels: [{ entranceX: 1, entranceY: 0, exitX: 3, exitY: 0, facing: 'east' }],
      clearBelts: [{ x: 1, y: 0 }],
    })
  } finally {
    resetBeltCrossQuery()
  }
})

test('BeltRedirectSession still tunnels a later crossing on empty portal cells', () => {
  setBeltCrossQuery({
    occupancy: () => ({
      conveyors: new Set(['0,0', '3,0']),
      blocked: new Set(),
    }),
    maxGap: () => 8,
    belts: () => [
      { x: 0, y: 0, direction: 'south', authorId: 'me' },
      { x: 3, y: 0, direction: 'north', authorId: 'me' },
    ],
  })
  try {
    const session = createBeltRedirectSession({ x: 0, y: 0, direction: 'south', authorId: 'me' })
    session.push({ x: 6, y: 0 })
    assert.deepEqual(session.finish()?.payload, {
      cells: [
        { x: 0, y: 0, direction: 'east' },
        { x: 1, y: 0, direction: 'east' },
        { x: 5, y: 0, direction: 'east' },
        { x: 6, y: 0, direction: 'east' },
      ],
      tunnels: [{ entranceX: 2, entranceY: 0, exitX: 4, exitY: 0, facing: 'east' }],
    })
  } finally {
    resetBeltCrossQuery()
  }
})

test('BeltRedirectSession keeps the origin belt in the stroke when it already exists on the map', () => {
  setBeltCrossQuery({
    occupancy: () => ({
      conveyors: new Set(['4,4', '4,3']),
      blocked: new Set(),
    }),
    maxGap: () => 3,
    belts: () => [
      { x: 4, y: 4, direction: 'east', authorId: 'me' },
      { x: 4, y: 3, direction: 'east', authorId: 'me' },
    ],
  })
  try {
    const session = createBeltRedirectSession({
      x: 4,
      y: 4,
      direction: 'east',
      authorId: 'me',
    })
    assert.equal(session.push({ x: 4, y: 1 }), true)
    const cells = session.previewBelts().map((cell) => ({
      x: cell.x,
      y: cell.y,
      direction: cell.direction,
    }))
    assert.deepEqual(cells[0], { x: 4, y: 4, direction: 'north' })
    assert.ok(cells.some((cell) => cell.x === 4 && cell.y === 4 && cell.direction === 'north'))
    assert.deepEqual(session.finish()?.payload, {
      cells: [
        { x: 4, y: 4, direction: 'north' },
        { x: 4, y: 2, direction: 'north' },
        { x: 4, y: 1, direction: 'north' },
      ],
    })
  } finally {
    resetBeltCrossQuery()
  }
})
