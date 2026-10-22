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
    assert.equal(sim.place(block({ id: 'second' })).error, 'busy')
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
})
