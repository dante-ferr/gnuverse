import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGameServer } from '../game-server/server.ts'
import type { Direction } from '../game-server/pipeline/geometry/direction.ts'
import { ahead, opposite } from '../game-server/pipeline/geometry/direction.ts'
import { CoreMachine } from '../game-server/pipeline/machines/core-machine.ts'
import { SourceMachine } from '../game-server/pipeline/machines/source-machine.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

function directionBetween(
  from: { x: number; y: number },
  to: { x: number; y: number },
): Direction {
  if (to.x > from.x) return 'east'
  if (to.x < from.x) return 'west'
  if (to.y > from.y) return 'south'
  return 'north'
}

function beltPathToCore(
  sourceOrigin: { x: number; y: number },
  sourceDirection: Direction,
  coreOrigin: { x: number; y: number },
) {
  const core = new CoreMachine('core', coreOrigin)
  const source = new SourceMachine('source', sourceOrigin, sourceDirection, 'circle', 4)
  const output = source.outputSlots()[0]!.cell
  const slots = core.inputSlots().filter((slot) => slot.travel === sourceDirection)
  const target = slots.reduce((best, slot) => {
    const dist =
      Math.abs(slot.cell.x - output.x) + Math.abs(slot.cell.y - output.y)
    const bestDist =
      Math.abs(best.cell.x - output.x) + Math.abs(best.cell.y - output.y)
    return dist < bestDist ? slot : best
  })
  const approach = ahead(target.cell.x, target.cell.y, opposite(sourceDirection))
  const path = [{ ...output }]
  let { x, y } = output
  while (x !== approach.x) {
    x += Math.sign(approach.x - x)
    path.push({ x, y })
  }
  while (y !== approach.y) {
    y += Math.sign(approach.y - y)
    path.push({ x, y })
  }
  return path.map((cell, index) => ({
    ...cell,
    direction:
      index < path.length - 1
        ? directionBetween(cell, path[index + 1]!)
        : sourceDirection,
  }))
}

test('a signed-in player can belt a starter element into the core and a guest cannot', async () => {
  let time = 1_000_000
  const folder = await mkdtemp(join(tmpdir(), 'gnuverse-pipeline-'))
  const identityProvider = createTestIdentityProvider({ now: () => time })
  const game = createGameServer({
    identityProvider,
    dbPath: join(folder, 'game.sqlite'),
    now: () => time,
    rules: { pipeline: { tickMs: 250 } },
  })
  const base = await game.listen()
  try {
    const register = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'ada',
        email: 'ada@example.org',
        password: 'test-password-123',
      }),
    })
    assert.equal(register.status, 201)
    const { token } = (await register.json()) as { token: string }
    const created = await fetch(`${base}/api/towers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Núcleo' }),
    })
    assert.equal(created.status, 201)
    const { room } = (await created.json()) as { room: { id: string } }
    const detail = await fetch(`${base}/api/towers/${room.id}`)
    const state = (await detail.json()) as {
      frame: {
        sources: { x: number; y: number; direction: Direction; shape: string; role?: string }[]
        source: { x: number; y: number; direction: Direction; shape: string; role?: string }
        core: { x: number; y: number }
        collaborators: { id: string }[]
      }
    }
    const guest = await fetch(`${base}/api/towers/${room.id}/place`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cells: [{ x: 0, y: 0, direction: 'east' }] }),
    })
    assert.equal(guest.status, 401)
    const { core } = state.frame
    const starters = new Set(['fire', 'water'])
    const source =
      (state.frame.sources ?? [state.frame.source]).find((item) =>
        starters.has(item.role ?? item.shape),
      ) ?? state.frame.source
    const cells = beltPathToCore(source, source.direction, core)
    const placed = await fetch(`${base}/api/towers/${room.id}/place`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cells }),
    })
    assert.equal(placed.status, 200)
    const joined = await fetch(`${base}/api/towers/${room.id}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    const body = (await joined.json()) as { frame: { collaborators: { nickname: string }[]; belts: unknown[] } }
    assert.equal(body.frame.collaborators[0]?.nickname, 'ada')
    assert.ok(body.frame.belts.length >= 2)
    await new Promise((resolve) => setTimeout(resolve, 4_000))
    const later = await fetch(`${base}/api/towers/${room.id}`)
    const after = (await later.json()) as { frame: { deliveries: number } }
    assert.ok(after.frame.deliveries > 0)
  } finally {
    await game.close()
    await rm(folder, { recursive: true, force: true })
  }
})
