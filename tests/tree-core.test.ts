import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGameServer } from '../game-server/server.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

test('tree action opens action window and returns to idle after physics', async () => {
  let time = 1_000_000
  const folder = await mkdtemp(join(tmpdir(), 'gnuverse-tree-'))
  const identityProvider = createTestIdentityProvider({ now: () => time })
  const game = createGameServer({
    identityProvider,
    dbPath: join(folder, 'game.sqlite'),
    now: () => time,
    rules: { intervalMs: 6000, cap: 5, initialBalance: 5 },
  })
  const base = await game.listen()
  try {
    const register = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'tree',
        email: 'tree@example.org',
        password: 'test-password-123',
      }),
    })
    const { token } = (await register.json()) as { token: string }
    const created = await fetch(`${base}/api/towers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'cli-cave' }),
    })
    const { tower } = (await created.json()) as { tower: { id: string } }
    const detail = await fetch(`${base}/api/towers/${tower.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const state = (await detail.json()) as {
      frame: { nodes: { id: string; x: number; y: number }[]; turn: { phase: string } }
    }
    const root = state.frame.nodes[0]!
    const grow = await fetch(`${base}/api/towers/${tower.id}/grow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: root.id, x: root.x, y: root.y - 40 }),
    })
    assert.equal(grow.status, 200)
    const afterGrow = (await grow.json()) as {
      frame: { turn: { phase: string }; nodes: unknown[] }
    }
    assert.equal(afterGrow.frame.turn.phase, 'actionWindow')
    assert.ok(afterGrow.frame.nodes.length >= 2)
    time += 11_000
    await new Promise((r) => setTimeout(r, 300))
    const status = await fetch(`${base}/api/towers/${tower.id}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const payload = (await status.json()) as { phase: string }
    assert.ok(['physics', 'idle'].includes(payload.phase))
  } finally {
    await game.close()
    await rm(folder, { recursive: true, force: true })
  }
})