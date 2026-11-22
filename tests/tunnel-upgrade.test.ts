import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTunnelUpgradeSession,
  tunnelSpeedChangeFromClick,
} from '../src/components/game/pipeline/scene/tunnel-upgrade.ts'
import type { PipelineFrame, PipelineRules } from '../src/components/game/pipeline/model/frame.ts'

const fastRules = { beltSpeedFast: 3 } as PipelineRules

function frameWithTunnel(speed = 1): PipelineFrame {
  return {
    kind: 'pipeline',
    version: '0.1',
    seed: 't',
    width: 48,
    height: 48,
    tick: 0,
    deliveries: 0,
    deliveryByShape: {},
    demands: [],
    collaborators: [],
    belts: [],
    packets: [],
    source: { id: 's', x: 0, y: 0, direction: 'east', shape: 'circle' },
    core: {
      id: 'c',
      x: 20,
      y: 20,
    },
    tunnels: [
      {
        id: 't1:in',
        pairId: 't1',
        role: 'entrance',
        x: 10,
        y: 12,
        direction: 'east',
        speed,
        authorId: 'me',
        authorNickname: 'Ada',
      },
      {
        id: 't1:out',
        pairId: 't1',
        role: 'exit',
        x: 14,
        y: 12,
        direction: 'east',
        speed,
        authorId: 'me',
        authorNickname: 'Ada',
      },
    ],
  }
}

test('tunnelSpeedChangeFromClick upgrades and downgrades an owned pair', () => {
  const normal = frameWithTunnel(1)
  assert.deepEqual(
    tunnelSpeedChangeFromClick(normal, { x: 14, y: 12 }, 'me', fastRules, 'fast_tunnel'),
    {
      machineId: 'fast_tunnel',
      entranceX: 10,
      entranceY: 12,
      exitX: 14,
      exitY: 12,
      facing: 'east',
    },
  )
  const fast = frameWithTunnel(3)
  assert.deepEqual(
    tunnelSpeedChangeFromClick(fast, { x: 10, y: 12 }, 'me', fastRules, 'tunnel'),
    {
      machineId: 'tunnel',
      entranceX: 10,
      entranceY: 12,
      exitX: 14,
      exitY: 12,
      facing: 'east',
    },
  )
  assert.equal(
    tunnelSpeedChangeFromClick(fast, { x: 10, y: 12 }, 'me', fastRules, 'fast_tunnel'),
    null,
  )
  assert.equal(
    tunnelSpeedChangeFromClick(normal, { x: 10, y: 12 }, 'other', fastRules, 'fast_tunnel'),
    null,
  )
})

test('createTunnelUpgradeSession commits the selected tunnel speed on finish', () => {
  const session = createTunnelUpgradeSession({
    machineId: 'tunnel',
    entranceX: 10,
    entranceY: 12,
    exitX: 14,
    exitY: 12,
    facing: 'east',
  })
  assert.equal(session.push({ x: 10, y: 12 }), false)
  assert.equal(session.previewMachines?.()?.[0]?.machineId, 'tunnel')
  assert.deepEqual(session.finish!(), {
    structureId: 'tunnel',
    payload: {
      machineId: 'tunnel',
      entranceX: 10,
      entranceY: 12,
      exitX: 14,
      exitY: 12,
      facing: 'east',
    },
  })
})
