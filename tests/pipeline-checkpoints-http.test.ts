import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGameServer } from '../game-server/server.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

type Checkpoint = { id: string; kind: string; chunks: number }
type Proposal = {
  id: string
  type: string
  status: string
  byMajority: boolean
  decidedByMajority?: boolean
  tally: { supporters: number; voters: number; needed: number }
}
type Detail = {
  room: { restoreByMajority: boolean; banByMajority: boolean; checkpointSpend: number }
  frame: { tick: number; ownedChunks: unknown[]; spentByUserId?: Record<string, number> }
  snapshots: Checkpoint[]
  proposals: Proposal[]
  members: { id: string; banned: boolean }[]
}

test('spend checkpoints, owner-decided and majority restores, majority bans', async () => {
  let time = 1_000_000
  const folder = await mkdtemp(join(tmpdir(), 'gnuverse-checkpoints-'))
  const game = createGameServer({
    identityProvider: createTestIdentityProvider({ now: () => time }),
    dbPath: join(folder, 'game.sqlite'),
    now: () => time,
    rules: {
      initialBalance: 50,
      pipeline: {
        tickMs: 250,
        chunkCostBase: 5,
        chunkCostStep: 2,
        passiveCap: 50,
        walletCap: 1_000_000,
        checkpointSpendCoins: 5,
        checkpointLimit: 2,
      },
    },
  })
  const base = await game.listen()
  const call = async (token: string | null, path: string, body?: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, body: (await response.json()) as Record<string, unknown> }
  }
  const register = async (nickname: string) => {
    const result = await call(null, '/api/register', {
      nickname,
      email: `${nickname}@example.org`,
      password: 'test-password-123',
    })
    assert.equal(result.status, 201)
    return { token: result.body.token as string, id: (result.body.user as { id: string }).id }
  }
  try {
    const owner = await register('dona')
    const ana = await register('ana')
    const bia = await register('bia')
    const created = await call(owner.token, '/api/rooms', { name: 'Checkpoints' })
    const roomId = (created.body.room as { id: string }).id
    const detail = async () => (await call(owner.token, `/api/rooms/${roomId}`)).body as Detail

    let state = await detail()
    assert.equal(state.room.restoreByMajority, false)
    assert.equal(state.room.banByMajority, false)
    assert.equal(state.snapshots.length, 1)
    assert.equal(state.snapshots[0]!.kind, 'created')
    const createdId = state.snapshots[0]!.id
    assert.equal('frame' in state.snapshots[0]!, false)
    const saved = await call(null, `/api/rooms/${roomId}/snapshots/${createdId}`)
    assert.equal(saved.status, 200)
    assert.equal((saved.body.frame as { kind: string }).kind, 'pipeline')
    assert.equal((await call(null, `/api/rooms/${roomId}/snapshots/nope`)).status, 404)

    // Spending the threshold saves a checkpoint and resets the counter.
    const preview = (await call(owner.token, `/api/rooms/${roomId}`)).body.frame as {
      previewChunks: { cx: number; cy: number }[]
    }
    const chunk = preview.previewChunks[0]!
    assert.equal((await call(owner.token, `/api/rooms/${roomId}/buy-chunk`, { ...chunk, amount: 3 })).status, 200)
    assert.equal((await detail()).room.checkpointSpend, 3)
    assert.equal((await call(ana.token, `/api/rooms/${roomId}/buy-chunk`, { ...chunk, amount: 2 })).status, 200)
    state = await detail()
    assert.equal(state.room.checkpointSpend, 0)
    assert.equal(state.frame.ownedChunks.length, 2)
    assert.deepEqual(state.snapshots.map((s) => s.kind), ['created', 'spend'])
    assert.equal(state.snapshots[1]!.chunks, 2)

    // Owner mode: a contributor proposes, others agree, the owner accepts.
    const proposed = await call(ana.token, `/api/rooms/${roomId}/proposals`, {
      type: 'restore',
      snapshotId: createdId,
      reason: 'Voltar ao início',
    })
    assert.equal(proposed.status, 200)
    const restoreId = (proposed.body.proposal as { id: string }).id
    assert.equal(
      (await call(ana.token, `/api/rooms/${roomId}/proposals/${restoreId}/support`, {})).status,
      409,
    )
    assert.equal(
      (await call(bia.token, `/api/rooms/${roomId}/proposals/${restoreId}/support`, {})).status,
      403,
    )
    assert.equal(
      (await call(owner.token, `/api/rooms/${roomId}/proposals/${restoreId}/support`, {})).status,
      200,
    )
    state = await detail()
    let proposal = state.proposals.find((p) => p.id === restoreId)!
    assert.equal(proposal.status, 'pending')
    assert.deepEqual(proposal.tally, { supporters: 2, voters: 2, needed: 2 })
    const tickBefore = state.frame.tick
    const spentBefore = state.frame.spentByUserId
    assert.equal(
      (
        await call(owner.token, `/api/rooms/${roomId}/proposals/${restoreId}/decide`, {
          accept: true,
          reason: 'De acordo',
        })
      ).status,
      200,
    )
    state = await detail()
    assert.equal(state.frame.ownedChunks.length, 1)
    assert.ok(state.frame.tick >= tickBefore)
    assert.deepEqual(state.frame.spentByUserId, spentBefore)
    assert.deepEqual(state.snapshots.map((s) => s.kind), ['created', 'spend', 'pre-restore'])

    // Majority mode: the owner cannot accept, agreement past half passes it.
    assert.equal(
      (
        await call(owner.token, `/api/rooms/${roomId}/settings`, {
          restoreByMajority: true,
          banByMajority: true,
          reason: 'Mais democracia',
        })
      ).status,
      200,
    )
    const spendId = state.snapshots.find((s) => s.kind === 'spend')!.id
    const majority = await call(ana.token, `/api/rooms/${roomId}/proposals`, {
      type: 'restore',
      snapshotId: spendId,
      reason: 'Recuperar o chunk',
    })
    const majorityId = (majority.body.proposal as { id: string }).id
    assert.equal(
      (
        await call(owner.token, `/api/rooms/${roomId}/proposals/${majorityId}/decide`, {
          accept: true,
          reason: 'Quero aceitar',
        })
      ).status,
      409,
    )
    assert.equal(
      (await call(owner.token, `/api/rooms/${roomId}/proposals/${majorityId}/support`, {})).status,
      200,
    )
    state = await detail()
    proposal = state.proposals.find((p) => p.id === majorityId)!
    assert.equal(proposal.status, 'accepted')
    assert.equal(proposal.decidedByMajority, true)
    assert.equal(state.frame.ownedChunks.length, 2)
    // checkpointLimit 2 keeps the creation checkpoint plus the two newest others.
    assert.equal(state.snapshots.filter((s) => s.kind !== 'created').length, 2)

    // Majority bans: the owner is never a target; the target does not vote.
    assert.equal((await call(bia.token, `/api/rooms/${roomId}/join`, {})).status, 200)
    assert.equal(
      (
        await call(ana.token, `/api/rooms/${roomId}/proposals`, {
          type: 'ban',
          targetId: owner.id,
          reason: 'Não pode',
        })
      ).status,
      400,
    )
    const ban = await call(ana.token, `/api/rooms/${roomId}/proposals`, {
      type: 'ban',
      targetId: bia.id,
      reason: 'Atrapalhando',
    })
    const banId = (ban.body.proposal as { id: string }).id
    assert.equal(
      (await call(owner.token, `/api/rooms/${roomId}/proposals/${banId}/support`, {})).status,
      200,
    )
    state = await detail()
    assert.equal(state.proposals.find((p) => p.id === banId)!.status, 'accepted')
    assert.equal(state.members.find((m) => m.id === bia.id)!.banned, true)
  } finally {
    await game.close()
    await rm(folder, { recursive: true, force: true })
  }
})
