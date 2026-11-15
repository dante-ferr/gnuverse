import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInitialTreeFrame } from '../game-server/physics/map-gen.ts'
import { TreeSimulation } from '../game-server/physics/tree/tree-simulation.ts'
import type { TreeNode } from '../game-server/physics/tree-types.ts'

function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared < 1e-6 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

test('physics keeps the branch and moves an anchor along its parent', () => {
  const frame = createInitialTreeFrame(0, 'physics-seed')
  const root = frame.nodes[0]!
  const branch: TreeNode = {
    id: 'branch',
    x: root.x + 80,
    y: root.y,
    parentId: root.id,
    authorId: 'tester',
    authorName: 'tester',
    leaf: false,
    fortified: false,
    secondaryRoot: false,
    attach: { x: root.x, y: root.y },
  }
  const twig: TreeNode = {
    id: 'twig',
    x: root.x + 40,
    y: root.y - 40,
    parentId: branch.id,
    authorId: 'tester',
    authorName: 'tester',
    leaf: false,
    fortified: false,
    secondaryRoot: false,
    attach: { x: root.x + 40, y: root.y },
  }
  frame.nodes.push(branch, twig)
  const sim = new TreeSimulation(frame)
  for (let step = 0; step < 240; step++) sim.step()
  const after = sim.read()
  const moved = after.nodes.find((node) => node.id === 'branch')!
  const child = after.nodes.find((node) => node.id === 'twig')!
  const length = Math.hypot(moved.x - moved.attach!.x, moved.y - moved.attach!.y)
  const drop = moved.y - root.y
  const gap = distanceToSegment(
    child.attach!.x,
    child.attach!.y,
    moved.attach!.x,
    moved.attach!.y,
    moved.x,
    moved.y,
  )
  assert.equal(Boolean(moved.broken), false)
  assert.ok(length > 75 && length < 85, `branch length collapsed to ${length}`)
  assert.ok(drop > 2 && drop < 35, `branch drop ${drop} is not a visible, firm sag`)
  assert.ok(gap < 2, `child detached from parent by ${gap}`)
  sim.dispose()
})
