import test from 'node:test'
import assert from 'node:assert/strict'
import { BLOCKS, WORLD, createSimulation } from '../game-server/physics/index.ts'
import type { BlockState, Simulation } from '../game-server/physics/index.ts'

const block = (overrides: Partial<BlockState> = {}): BlockState => ({
  id: 'block-1',
  kind: 'square',
  x: 500,
  y: 100,
  angle: 0,
  color: '#8b5cf6',
  authorId: 'player-1',
  vx: 0,
  vy: 0,
  angularVelocity: 0,
  sleeping: false,
  ...overrides,
})

function settle(simulation: Simulation, maxTicks = 1800) {
  for (let i = 0; i < maxTicks; i += 1) {
    const frame = simulation.step()
    if (frame.settled) return frame
  }
  assert.fail('Simulation did not settle')
}

test('empty world is settled; a falling block rests on the floor', () => {
  const sim = createSimulation()
  try {
    assert.equal(sim.read().settled, true)
    assert.deepEqual(sim.place(block()), { ok: true })
    assert.equal(sim.read().settled, false)
    assert.equal(sim.place(block({ id: 'second' })).error, 'overlap')
    const frame = settle(sim)
    assert.ok(Math.abs(frame.blocks[0].y - (WORLD.groundY - 30)) < 1)
    assert.equal(frame.blocks[0].sleeping, true)
    assert.ok(frame.tick > 60)
  } finally {
    sim.dispose()
  }
})

test('placement checks rotated bounds and SAT overlap', () => {
  const sim = createSimulation([block({ y: 710, sleeping: true })])
  try {
    assert.equal(
      sim.place(block({ id: 'edge', x: 10, angle: Math.PI / 4 })).error,
      'bounds',
    )
    assert.equal(sim.place(block({ id: 'bottom', y: 735 })).error, 'bounds')
    assert.equal(sim.place(block({ id: 'overlap', y: 700 })).error, 'overlap')
    assert.equal(sim.place(block({ id: 'invalid', x: NaN })).error, 'invalid')
    assert.equal(
      sim.place(block({ id: 'rotated', y: 500, angle: 0.3 })).ok,
      true,
    )
    assert.equal(sim.read().blocks[1].angle, 0.3)
  } finally {
    sim.dispose()
  }
})

test('SAT allows rotated blocks whose bounding boxes overlap but shapes do not', () => {
  const sim = createSimulation([
    block({ kind: 'wide', y: 300, angle: Math.PI / 4, sleeping: true }),
  ])
  try {
    assert.equal(
      sim.place(
        block({
          id: 'parallel',
          kind: 'wide',
          x: 540,
          y: 260,
          angle: Math.PI / 4,
        }),
      ).ok,
      true,
    )
  } finally {
    sim.dispose()
  }
})

test('a balanced stack remains while an overhanging beam rotates and collapses', () => {
  const base = block({ y: 710, sleeping: true })
  const sim = createSimulation([base])
  try {
    assert.equal(sim.place(block({ id: 'stack', y: 620 })).ok, true)
    const stable = settle(sim)
    const upper = stable.blocks.find(({ id }) => id === 'stack')
    assert.ok(upper)
    assert.ok(Math.abs(upper.y - 650) < 2)
    assert.ok(Math.abs(upper.angle) < 0.02)
    sim.restore([base])
    assert.equal(
      sim.place(block({ id: 'beam', kind: 'wide', x: 547, y: 640 })).ok,
      true,
    )
    let rotation = 0
    for (let i = 0; i < 900; i += 1) {
      const beam = sim.step().blocks.find(({ id }) => id === 'beam')
      assert.ok(beam)
      rotation = Math.max(rotation, Math.abs(beam.angle))
    }
    const beam = sim.read().blocks.find(({ id }) => id === 'beam')
    assert.ok(beam)
    assert.ok(rotation > 0.3, 'beam must visibly rotate')
    const verticalExtent =
      (Math.abs(Math.sin(beam.angle)) * BLOCKS.wide.width +
        Math.abs(Math.cos(beam.angle)) * BLOCKS.wide.height) /
      2
    assert.ok(
      Math.abs(beam.y + verticalExtent - WORLD.groundY) < 2,
      'beam reaches the floor',
    )
    assert.ok(beam.x > 560, 'beam falls off the support')
  } finally {
    sim.dispose()
  }
})

test('restore preserves serializable state and rejects malformed snapshots atomically', () => {
  const sim = createSimulation()
  try {
    sim.place(block())
    const snapshot = settle(sim).blocks
    sim.restore([])
    assert.equal(sim.read().blocks.length, 0)
    sim.restore(JSON.parse(JSON.stringify(snapshot)))
    assert.deepEqual(sim.read().blocks, snapshot)
    assert.equal(sim.read().settled, true)
    assert.throws(() => sim.restore([block({ vx: Infinity })]), /Invalid/)
    assert.deepEqual(sim.read().blocks, snapshot)
    assert.equal(sim.place(block({ id: 'next', y: 500 })).ok, true)
    sim.restore([
      block({ vx: 2, vy: -1, angularVelocity: 0.02, sleeping: false }),
    ])
    const moving = sim.read()
    assert.equal(moving.settled, false)
    assert.equal(moving.blocks[0].vx, 2)
    assert.equal(moving.blocks[0].vy, -1)
    assert.equal(moving.blocks[0].angularVelocity, 0.02)
  } finally {
    sim.dispose()
  }
})

test('body limit and disposal have explicit behavior', () => {
  const saved = Array.from({ length: WORLD.maxBlocks }, (_, i) =>
    block({
      id: `saved-${i}`,
      x: i * 80,
      sleeping: true,
    }),
  )
  const sim = createSimulation(saved)
  assert.equal(sim.place(block({ id: 'one-too-many' })).error, 'limit')
  sim.dispose()
  sim.dispose()
  assert.throws(() => sim.step(), /disposed/)
  assert.throws(() => sim.applyWind(0.3, 1), /disposed/)
})

test('stone stack absorbs a falling load without sustained bouncing or compression', () => {
  const sim = createSimulation(Array.from({ length: 8 }, (_, index) => block({
    id: `stone-${index}`, y: 710 - index * 60,
  })))
  try {
    const initial = settle(sim)
    const top = initial.blocks.at(-1)!
    assert.equal(sim.place(block({ id: 'load', y: 100 })).ok, true)
    let contact = false
    let deepest = 0
    let rebound = 0
    for (let index = 0; index < 600; index += 1) {
      const load = sim.step().blocks.at(-1)!
      if (load.y >= top.y - 60 - 0.5) contact = true
      if (contact) {
        deepest = Math.max(deepest, load.y)
        rebound = Math.max(rebound, deepest - load.y)
      }
    }
    assert.equal(contact, true)
    assert.ok(rebound < 3, `numerical rebound must remain below 3 world pixels, got ${rebound}`)
    const resting = sim.read()
    assert.equal(resting.settled, true)
    for (const [index, stone] of resting.blocks.entries()) {
      assert.ok(Math.abs(stone.y - (710 - index * 60)) < 0.5, 'load must not compress the stack')
      assert.equal(stone.vy, 0)
      assert.equal(stone.angularVelocity, 0)
    }
    for (let index = 0; index < 180; index += 1) sim.step()
    assert.deepEqual(sim.read().blocks, resting.blocks, 'resting stone must not jitter')
  } finally { sim.dispose() }
})

test('five seconds of wind topples a narrow tower while a broad stone stays supported', () => {
  const broad = createSimulation([block({ kind: 'wide', y: 722 })])
  const narrow = createSimulation(Array.from({ length: 3 }, (_, index) => block({
    id: `column-${index}`, kind: 'tall', y: 690 - index * 100,
  })))
  try {
    settle(broad)
    settle(narrow)
    broad.applyWind(0.3, 1)
    assert.equal(broad.read().settled, false)
    assert.equal(broad.read().blocks[0].sleeping, false)
    for (let index = 0; index < 300; index += 1) {
      broad.applyWind(0.3, 1)
      narrow.applyWind(0.3, 1)
      broad.step()
      narrow.step()
    }
    const broadFrame = settle(broad)
    const narrowFrame = settle(narrow)
    const stone = broadFrame.blocks[0]
    assert.ok(Math.abs(stone.angle) < 0.01)
    assert.ok(Math.abs(stone.y - 722) < 0.1)
    const maxShift = Math.max(...narrowFrame.blocks.map(piece => Math.abs(piece.x - 500)))
    assert.ok(maxShift > Math.abs(stone.x - 500) + 100)
    assert.ok(narrowFrame.blocks.every(piece => Math.abs(piece.angle) > 1), 'columns must actually topple')
  } finally { broad.dispose(); narrow.dispose() }
})

test('wind is mass-scaled, directional and consumed after one physics tick', () => {
  const left = createSimulation([block({ y: 200, sleeping: true })])
  const right = createSimulation([block({ kind: 'wide', y: 200, sleeping: true })])
  const control = createSimulation([block({ y: 200, sleeping: true })])
  try {
    left.applyWind(0.3, -1)
    right.applyWind(0.3, 1)
    control.applyWind(0, 1)
    const firstLeft = left.step().blocks[0]
    const firstRight = right.step().blocks[0]
    assert.ok(firstLeft.vx < 0 && firstRight.vx > 0)
    assert.ok(Math.abs(firstLeft.vx + firstRight.vx) < 1e-8, 'equal acceleration despite different masses')
    const next = left.step().blocks[0]
    assert.ok(Math.abs(next.vx) < Math.abs(firstLeft.vx), 'wind stops without another call')
    assert.equal(control.step().blocks[0].x, 500)
    assert.throws(() => left.applyWind(Infinity, 1), /Invalid wind/)
    assert.throws(() => left.applyWind(-0.1, 1), /Invalid wind/)
    assert.throws(() => left.applyWind(1.1, 1), /Invalid wind/)
  } finally { left.dispose(); right.dispose(); control.dispose() }
})

test('accepts separate blocks in flight and checks overlap against moving bodies', () => {
  const sim = createSimulation()
  try {
    assert.equal(sim.place(block({ x: 200 })).ok, true)
    sim.step()
    assert.equal(sim.read().settled, false)
    assert.equal(sim.place(block({ id: 'moving-second', x: 700 })).ok, true)
    assert.equal(sim.place(block({ id: 'collision', x: 700 })).error, 'overlap')
    assert.equal(settle(sim).blocks.length, 2)
  } finally {
    sim.dispose()
  }
})
