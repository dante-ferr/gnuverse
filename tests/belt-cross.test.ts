import assert from 'node:assert/strict'
import test from 'node:test'
import { CombinerMachine } from '../game-server/pipeline/machines/combiner-machine.ts'
import { SplitterMachine } from '../game-server/pipeline/machines/splitter-machine.ts'
import { planBeltCrossings, resetBeltCrossQuery, setBeltCrossQuery } from '../src/components/game/pipeline/scene/belt-cross.ts'
import type { StrokeCell } from '../src/components/game/pipeline/scene/belt-stroke.ts'
import { getStructure } from '../src/components/game/pipeline/structures/index.ts'

const keys = (...cells: { x: number; y: number }[]) => new Set(cells.map((cell) => `${cell.x},${cell.y}`))

function line(
  from: number,
  to: number,
  axis: 'x' | 'y',
  fixed: number,
  direction: StrokeCell['direction'],
): StrokeCell[] {
  const cells: StrokeCell[] = []
  const step = from <= to ? 1 : -1
  for (let cursor = from; cursor !== to + step; cursor += step) {
    cells.push(
      axis === 'x'
        ? { x: cursor, y: fixed, direction }
        : { x: fixed, y: cursor, direction },
    )
  }
  return cells
}

function east(from: number, to: number, y = 0) {
  return line(from, to, 'x', y, 'east')
}

test('a single crossed belt becomes one tunnel and keeps the belts on either side', () => {
  const plan = planBeltCrossings(east(0, 5), keys({ x: 3, y: 0 }), keys(), 8)
  assert.deepEqual(
    plan.tunnels,
    [{ entranceX: 2, entranceY: 0, exitX: 4, exitY: 0, facing: 'east' }],
  )
  assert.deepEqual(
    plan.belts.map((cell) => cell.x),
    [0, 1, 5],
  )
})

test('a run as wide as tunnel_max_gap still places one tunnel', () => {
  const conveyors = keys(...[2, 3, 4, 5, 6, 7, 8, 9].map((x) => ({ x, y: 0 })))
  const plan = planBeltCrossings(east(0, 11), conveyors, keys(), 8)
  assert.deepEqual(plan.tunnels, [
    { entranceX: 1, entranceY: 0, exitX: 10, exitY: 0, facing: 'east' },
  ])
  assert.deepEqual(plan.belts.map((cell) => cell.x), [0, 11])
})

test('a run thicker than tunnel_max_gap places no tunnel and skips those belts', () => {
  const conveyors = keys(...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => ({ x, y: 0 })))
  const plan = planBeltCrossings(east(0, 10), conveyors, keys(), 8)
  assert.deepEqual(plan.tunnels, [])
  assert.deepEqual(plan.belts.map((cell) => cell.x), [0, 10])
})

test('one-tile gaps inside the limit become one underground span', () => {
  const conveyors = keys({ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 })
  const plan = planBeltCrossings(east(0, 8), conveyors, keys(), 8)
  assert.deepEqual(plan.tunnels, [
    { entranceX: 1, entranceY: 0, exitX: 7, exitY: 0, facing: 'east' },
  ])
  assert.deepEqual(plan.belts.map((cell) => cell.x), [0, 8])
})

test('one-tile gaps that push the span past the limit place no tunnel', () => {
  const xs = [1, 2, 4, 5, 7, 8, 10, 11, 13, 14]
  const conveyors = keys(...xs.map((x) => ({ x, y: 0 })))
  const plan = planBeltCrossings(east(0, 15), conveyors, keys(), 8)
  assert.deepEqual(plan.tunnels, [])
  assert.deepEqual(
    plan.belts.map((cell) => cell.x),
    [0, 3, 6, 9, 12, 15],
  )
})

test('three empty cells between runs stay one tunnel when span fits maxGap', () => {
  const conveyors = keys({ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 })
  const plan = planBeltCrossings(east(0, 10), conveyors, keys(), 8)
  assert.deepEqual(plan.tunnels, [
    { entranceX: 1, entranceY: 0, exitX: 9, exitY: 0, facing: 'east' },
  ])
  assert.deepEqual(plan.belts.map((cell) => cell.x), [0, 10])
})

test('many free cells between short runs still use one tunnel under maxGap', () => {
  const conveyors = keys({ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 })
  const plan = planBeltCrossings(east(0, 10), conveyors, keys(), 8)
  assert.deepEqual(plan.tunnels, [
    { entranceX: 1, entranceY: 0, exitX: 8, exitY: 0, facing: 'east' },
  ])
  assert.deepEqual(plan.belts.map((cell) => cell.x), [0, 9, 10])
})

test('two tunnels when a single span would exceed maxGap', () => {
  const xs = [2, 3, 12, 13]
  const conveyors = keys(...xs.map((x) => ({ x, y: 0 })))
  const plan = planBeltCrossings(east(0, 15), conveyors, keys(), 8)
  assert.deepEqual(
    plan.tunnels.map((tunnel) => [tunnel.entranceX, tunnel.exitX]),
    [
      [1, 10],
      [11, 14],
    ],
  )
  assert.deepEqual(plan.belts.map((cell) => cell.x), [0, 15])
})

test('two empty cells stay inside one tunnel when the span fits', () => {
  const conveyors = keys({ x: 2, y: 0 }, { x: 5, y: 0 })
  const plan = planBeltCrossings(east(0, 7), conveyors, keys(), 8)
  assert.deepEqual(plan.tunnels, [
    { entranceX: 1, entranceY: 0, exitX: 6, exitY: 0, facing: 'east' },
  ])
  assert.deepEqual(plan.belts.map((cell) => cell.x), [0, 7])
})

test('a single belt after a too-thick run is not tunneled off that run', () => {
  const thick = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const conveyors = keys(...thick.map((x) => ({ x, y: 0 })), { x: 11, y: 0 })
  const plan = planBeltCrossings(east(0, 13), conveyors, keys(), 8)
  assert.deepEqual(plan.tunnels, [])
  assert.deepEqual(plan.belts.map((cell) => cell.x), [0, 10, 12, 13])
})

test('a port-fed entrance and a port-accepted exit need no spacer belts', () => {
  const combiner = new CombinerMachine('c', 'combiner_2', { x: 25, y: 24 }, 'north')
  const splitter = new SplitterMachine('s', { x: 25, y: 30 }, 'north', {
    id: 'u',
    nickname: 'Ada',
  })
  const stroke = line(29, 27, 'y', 25, 'north')
  const plan = planBeltCrossings(stroke, keys({ x: 25, y: 28 }), keys(), 8, [
    ...splitter.slots,
    ...combiner.slots,
  ])
  assert.deepEqual(plan.tunnels, [
    { entranceX: 25, entranceY: 29, exitX: 25, exitY: 27, facing: 'north' },
  ])
  assert.deepEqual(
    plan.belts.map((cell) => cell.y),
    [],
  )
})

test('a stroke that starts or ends on belts does not invent a portal', () => {
  const conveyors = keys({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 })
  const plan = planBeltCrossings(east(0, 5), conveyors, keys(), 8)
  assert.deepEqual(plan.tunnels, [])
  assert.deepEqual(plan.belts.map((cell) => cell.x), [2, 3])
})

test('a stroke that starts and ends on cells adjacent to a crossed belt tunnels', () => {
  const plan = planBeltCrossings(east(2, 4), keys({ x: 3, y: 0 }), keys(), 8)
  assert.deepEqual(plan.tunnels, [
    { entranceX: 2, entranceY: 0, exitX: 4, exitY: 0, facing: 'east' },
  ])
  assert.deepEqual(plan.belts.map((cell) => cell.x), [])
})

test('a southbound adjacent start and end across a horizontal belt tunnels', () => {
  const stroke = line(4, 6, 'y', 3, 'south')
  const plan = planBeltCrossings(stroke, keys({ x: 3, y: 5 }), keys(), 8)
  assert.deepEqual(plan.tunnels, [
    { entranceX: 3, entranceY: 4, exitX: 3, exitY: 6, facing: 'south' },
  ])
  assert.deepEqual(plan.belts.map((cell) => cell.y), [])
})

test('a westbound crossing uses the travel direction', () => {
  const stroke = line(5, 0, 'x', 2, 'west')
  const plan = planBeltCrossings(stroke, keys({ x: 3, y: 2 }), keys(), 8)
  assert.deepEqual(plan.tunnels, [
    { entranceX: 4, entranceY: 2, exitX: 2, exitY: 2, facing: 'west' },
  ])
  assert.deepEqual(
    plan.belts.map((cell) => cell.x),
    [5, 1, 0],
  )
})

test('an L stroke tunnels only the leg that crosses', () => {
  const stroke: StrokeCell[] = [
    ...east(0, 4),
    { x: 4, y: 1, direction: 'south' },
    { x: 4, y: 2, direction: 'south' },
  ]
  const plan = planBeltCrossings(stroke, keys({ x: 2, y: 0 }), keys(), 8)
  assert.deepEqual(plan.tunnels, [
    { entranceX: 1, entranceY: 0, exitX: 3, exitY: 0, facing: 'east' },
  ])
  assert.deepEqual(
    plan.belts.map((cell) => ({ x: cell.x, y: cell.y })),
    [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ],
  )
})

test('a machine in a one-tile gap stays inside the tunnel span', () => {
  const conveyors = keys({ x: 2, y: 0 }, { x: 4, y: 0 })
  const blocked = keys({ x: 3, y: 0 })
  const plan = planBeltCrossings(east(0, 6), conveyors, blocked, 8)
  assert.deepEqual(plan.tunnels, [
    { entranceX: 1, entranceY: 0, exitX: 5, exitY: 0, facing: 'east' },
  ])
  assert.deepEqual(plan.belts.map((cell) => cell.x), [0, 6])
})

test('a machine alone does not insert a tunnel', () => {
  const plan = planBeltCrossings(east(0, 4), keys(), keys({ x: 2, y: 0 }), 8)
  assert.deepEqual(plan.tunnels, [])
  assert.deepEqual(plan.belts.map((cell) => cell.x), [0, 1, 3, 4])
})

test('belt commit places the tunnel before the remaining belts', async () => {
  setBeltCrossQuery({
    maxGap: () => 8,
    occupancy: () => ({ conveyors: keys({ x: 2, y: 0 }), blocked: keys() }),
  })
  try {
    const belt = getStructure('belt')
    assert.ok(belt)
    const session = belt.createSession()
    session.push({ x: 0, y: 0 })
    session.push({ x: 4, y: 0 })
    const request = session.finish()
    assert.ok(request)
    const calls: { path: string; body: unknown }[] = []
    await belt.commit(
      {
        roomId: 'room-1',
        request: async (path, body) => {
          calls.push({ path, body })
          return {}
        },
      },
      request.payload,
    )
    assert.equal(calls.length, 2)
    assert.equal(calls[0]?.path, '/api/towers/room-1/place-machine')
    assert.deepEqual(calls[0]?.body, {
      machineId: 'tunnel',
      entranceX: 1,
      entranceY: 0,
      exitX: 3,
      exitY: 0,
      facing: 'east',
    })
    assert.equal(calls[1]?.path, '/api/towers/room-1/place')
    const cells = (calls[1]?.body as { cells: { x: number }[] }).cells
    assert.deepEqual(cells.map((cell) => cell.x), [0, 4])
  } finally {
    resetBeltCrossQuery()
  }
})
