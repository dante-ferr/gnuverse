import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reachDistanceAtAngle } from '../core/tree/reach-mask.ts'
import { hitTestSprout, snapAnchorToTip } from '../core/tree/segment-geometry.ts'
import { terrainSurfaceY } from '../core/tree/terrain.ts'
import {
  createInitialTreeFrame,
  verifyAnchorOnSegment,
} from '../game-server/physics/map-gen.ts'
import { terrainConfig, treeRules } from '../game-server/physics/tree-constants.ts'

test('sprout shaft accepts a grow anchor', () => {
  const frame = createInitialTreeFrame(0, 'reach-seed')
  const root = frame.nodes[0]!
  const rules = treeRules()
  const groundY = terrainSurfaceY(root.x, 'reach-seed', terrainConfig(rules))
  const midY = (groundY + root.y) / 2
  const hit = hitTestSprout(root, groundY, root.x + 4, midY, rules.segmentHitPadding)
  assert.ok(hit)
  assert.equal(hit.segmentId, root.id)
  const check = verifyAnchorOnSegment(frame, root.id, hit.x, hit.y, rules)
  assert.equal(check.ok, true)
})

test('anchor near a tip snaps onto that tip', () => {
  const hit = {
    segmentId: 'child',
    parentId: 'parent',
    t: 0.92,
    x: 88,
    y: 2,
  }
  const snapped = snapAnchorToTip(hit, 0, 0, 90, 0, 'parent', 16)
  assert.equal(snapped.segmentId, 'child')
  assert.equal(snapped.x, 90)
  assert.equal(snapped.y, 0)
  assert.equal(snapped.t, 1)
  const atBase = snapAnchorToTip(
    { ...hit, x: 2, y: 1, t: 0.02 },
    0,
    0,
    90,
    0,
    'parent',
    16,
  )
  assert.equal(atBase.segmentId, 'parent')
  assert.equal(atBase.x, 0)
  assert.equal(atBase.y, 0)
})

test('reach circle drops the half behind the clicked sprout and stops at other branches', () => {
  const anchor = { x: 100, y: 40 }
  const sprout = {
    id: 'root',
    ax: 100,
    ay: 160,
    bx: anchor.x,
    by: anchor.y,
  }
  const blocking = {
    id: 'side',
    ax: 70,
    ay: 0,
    bx: 130,
    by: 0,
  }
  const up = reachDistanceAtAngle(anchor.x, anchor.y, -Math.PI / 2, 90, [sprout, blocking], 'root', 4)
  const down = reachDistanceAtAngle(anchor.x, anchor.y, Math.PI / 2, 90, [sprout], 'root', 4)
  const clearUp = reachDistanceAtAngle(anchor.x, anchor.y, -Math.PI / 2, 90, [sprout], 'root', 4)
  assert.equal(down, 0)
  assert.equal(clearUp, 90)
  assert.ok(up < 50)
  assert.ok(up > 20)
  const mid = { x: 100, y: 100 }
  const throughWood = reachDistanceAtAngle(mid.x, mid.y, -Math.PI / 2, 90, [sprout], 'root', 4)
  const aside = reachDistanceAtAngle(mid.x, mid.y, -0.4, 90, [sprout], 'root', 4)
  assert.ok(throughWood < 8)
  assert.ok(aside > 80)
})
