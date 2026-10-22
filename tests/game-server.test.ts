import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGameServer } from '../game-server/server.ts'

type MemberData = { id: string; contributions: number }
type ProposalData = { id: string; electorate: string[]; status: string }
type EventData = { type: string }
type Data = {
  token: string
  user: { id: string; nickname: string }
  wallet: { balance: number }
  tower: { id: string; allowCreatorBan: boolean }
  snapshots: { id: string }[]
  frame: { blocks: object[]; settled: boolean }
  members: MemberData[]
  events: EventData[]
  proposal: ProposalData
  proposals: ProposalData[]
}
async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), 'gnuverse-game-'))
  let time = 100000
  const dbPath = join(folder, 'game.sqlite')
  const game = createGameServer({
    dbPath,
    now: () => time,
    rules: {
      cooldownMs: 100,
      intervalMs: 1000,
      proposalDurationMs: 100,
      minContributions: 1,
      banDurationMs: 1000,
    },
  })
  const base = await game.listen()
  async function request(
    path: string,
    token?: string,
    body?: object,
  ): Promise<{ status: number; data: Data }> {
    const response = await fetch(`${base}/api${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    return { status: response.status, data: (await response.json()) as Data }
  }
  async function register(nickname: string) {
    const response = await request('/register', undefined, {
      nickname,
      email: `${nickname}@example.org`,
      password: 'test-password-123',
    })
    assert.equal(response.status, 201)
    return response.data
  }
  return {
    game,
    base,
    dbPath,
    request,
    register,
    advance: (ms: number) => {
      time += ms
    },
    close: async () => {
      await game.close()
      await rm(folder, { recursive: true, force: true })
    },
  }
}

test('email authentication, private data, persisted sessions, logout and CORS', async () => {
  const f = await fixture()
  try {
    const player = await f.register('player')
    assert.equal(
      (
        await f.request('/register', undefined, {
          nickname: 'other',
          email: 'PLAYER@example.org',
          password: 'test-password-123',
        })
      ).status,
      409,
    )
    assert.equal(
      (
        await f.request('/login', undefined, {
          email: 'PLAYER@example.org',
          password: 'wrong-password',
        })
      ).status,
      401,
    )
    const login = await f.request('/login', undefined, {
      email: 'PLAYER@example.org',
      password: 'test-password-123',
    })
    assert.equal(login.status, 200)
    const me = await f.request('/me', login.data.token)
    assert.deepEqual(Object.keys(me.data.user).sort(), ['id', 'nickname'])
    assert.equal((await f.request('/me')).status, 401)
    assert.equal(
      (
        await fetch(`${f.base}/api/health`, {
          headers: { Origin: 'https://evil.example' },
        })
      ).status,
      403,
    )
    await f.game.close()
    const restarted = createGameServer({ dbPath: f.dbPath, now: () => 100000 })
    try {
      const base = await restarted.listen()
      const response = await fetch(`${base}/api/me`, {
        headers: { Authorization: `Bearer ${player.token}` },
      })
      assert.equal(response.status, 200)
      const logout = await fetch(`${base}/api/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${player.token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
      assert.equal(logout.status, 200)
      assert.equal(
        (
          await fetch(`${base}/api/me`, {
            headers: { Authorization: `Bearer ${player.token}` },
          })
        ).status,
        401,
      )
      const disk = await readFile(f.dbPath)
      assert.equal(disk.includes(Buffer.from(player.token)), false)
    } finally {
      await restarted.close()
    }
  } finally {
    await f.close()
  }
})

test('global economy validates atomic placements, cooldown, regeneration and public SSE', async () => {
  const f = await fixture()
  try {
    const player = await f.register('builder')
    const created = await f.request('/towers', player.token, {
      name: 'Torre teste',
      cost: 3,
      minContributions: 1,
    })
    const id = created.data.tower.id
    assert.equal(
      (
        await f.request(`/towers/${id}/blocks`, undefined, {
          kind: 'square',
          x: 500,
          y: 100,
        })
      ).status,
      401,
    )
    const placed = await f.request(`/towers/${id}/blocks`, player.token, {
      kind: 'square',
      x: 500,
      y: 100,
      color: '#123456',
    })
    assert.equal(placed.status, 200)
    assert.equal(placed.data.wallet.balance, 17)
    assert.equal(
      (
        await f.request(`/towers/${id}/blocks`, player.token, {
          x: 300,
          y: 100,
        })
      ).status,
      429,
    )
    f.advance(100)
    assert.equal(
      (
        await f.request(`/towers/${id}/blocks`, player.token, {
          x: 500,
          y: 100,
        })
      ).status,
      409,
    )
    assert.equal((await f.request('/me', player.token)).data.wallet.balance, 17)
    f.advance(5000)
    assert.equal((await f.request('/me', player.token)).data.wallet.balance, 20)
    const details = (await f.request(`/towers/${id}`)).data
    assert.equal(details.members[0].contributions, 1)
    assert.equal(JSON.stringify(details).includes('builder@example.org'), false)
    assert.equal(JSON.stringify(details).includes('test-password'), false)
    const controller = new AbortController()
    const stream = await fetch(`${f.base}/api/towers/${id}/events`, {
      signal: controller.signal,
    })
    const reader = stream.body!.getReader()
    const initial = new TextDecoder().decode((await reader.read()).value)
    assert.match(initial, /event: frame/)
    assert.match(initial, /"blocks"/)
    controller.abort()
  } finally {
    await f.close()
  }
})

test('BDFL restore preserves spent coins and contributions; ban remains local and expires', async () => {
  const f = await fixture()
  try {
    const owner = await f.register('owner')
    const player = await f.register('guest')
    const id = (
      await f.request('/towers', owner.token, {
        name: 'Governança',
        restoreMode: 'bdfl',
        banMode: 'bdfl',
        cost: 1,
        minContributions: 1,
      })
    ).data.tower.id
    const initial = (await f.request(`/towers/${id}`)).data.snapshots[0].id
    await f.request(`/towers/${id}/blocks`, player.token, { x: 300, y: 100 })
    const proposal = (
      await f.request(`/towers/${id}/proposals`, player.token, {
        type: 'restore',
        targetId: initial,
        reason: 'Recomeçar a construção',
      })
    ).data.proposal
    assert.equal(
      (
        await f.request(
          `/towers/${id}/proposals/${proposal.id}/decide`,
          player.token,
          { accept: true, reason: 'Quero restaurar' },
        )
      ).status,
      403,
    )
    assert.equal(
      (
        await f.request(
          `/towers/${id}/proposals/${proposal.id}/decide`,
          owner.token,
          { accept: true, reason: '' },
        )
      ).status,
      400,
    )
    assert.equal(
      (
        await f.request(
          `/towers/${id}/proposals/${proposal.id}/decide`,
          owner.token,
          { accept: true, reason: 'Retomar estado vazio' },
        )
      ).status,
      200,
    )
    let details = (await f.request(`/towers/${id}`)).data
    assert.equal(details.frame.blocks.length, 0)
    assert.equal(
      details.members.find((m: MemberData) => m.id === player.user.id)!
        .contributions,
      1,
    )
    assert.equal((await f.request('/me', player.token)).data.wallet.balance, 19)
    assert.ok(details.events.some((e: EventData) => e.type === 'restore'))
    const ban = (
      await f.request(`/towers/${id}/proposals`, owner.token, {
        type: 'ban',
        targetId: player.user.id,
        reason: 'Teste de banimento',
      })
    ).data.proposal
    await f.request(`/towers/${id}/proposals/${ban.id}/decide`, owner.token, {
      accept: true,
      reason: 'Decisão pública do BDFL',
    })
    f.advance(100)
    assert.equal(
      (
        await f.request(`/towers/${id}/blocks`, player.token, {
          x: 300,
          y: 100,
        })
      ).status,
      403,
    )
    const other = (
      await f.request('/towers', player.token, { name: 'Outra torre' })
    ).data.tower.id
    assert.equal(
      (
        await f.request(`/towers/${other}/blocks`, player.token, {
          x: 300,
          y: 100,
        })
      ).status,
      200,
    )
    f.advance(1000)
    assert.equal(
      (
        await f.request(`/towers/${id}/blocks`, player.token, {
          x: 300,
          y: 100,
        })
      ).status,
      200,
    )
  } finally {
    await f.close()
  }
})

test('frozen electorate, one vote each, no BDFL veto and tie rejects after deadline', async () => {
  const f = await fixture()
  try {
    const owner = await f.register('voterone')
    const player = await f.register('votertwo')
    const late = await f.register('voterlate')
    const id = (
      await f.request('/towers', owner.token, {
        name: 'Torre voto',
        minContributions: 1,
        cost: 0,
      })
    ).data.tower.id
    await f.request(`/towers/${id}/blocks`, player.token, { x: 300, y: 100 })
    const initial = (await f.request(`/towers/${id}`)).data.snapshots[0].id
    const p = (
      await f.request(`/towers/${id}/proposals`, owner.token, {
        type: 'restore',
        targetId: initial,
        reason: 'Retomar início',
      })
    ).data.proposal
    assert.equal(p.electorate.length, 2)
    for (
      let tries = 0;
      tries < 100 && !(await f.request(`/towers/${id}`)).data.frame.settled;
      tries++
    ) {
      assert.equal((await f.request('/me')).status, 401)
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    assert.equal(
      (await f.request(`/towers/${id}`)).data.frame.settled,
      true,
      'rejected requests must not restart an active simulation',
    )
    assert.equal(
      (await f.request(`/towers/${id}/blocks`, late.token, { x: 700, y: 100 }))
        .status,
      200,
    )
    assert.equal(
      (
        await f.request(`/towers/${id}/proposals/${p.id}/vote`, late.token, {
          choice: 'for',
        })
      ).status,
      403,
    )
    assert.equal(
      (
        await f.request(`/towers/${id}/proposals/${p.id}/vote`, owner.token, {
          choice: 'for',
        })
      ).status,
      200,
    )
    assert.equal(
      (
        await f.request(`/towers/${id}/proposals/${p.id}/vote`, owner.token, {
          choice: 'against',
        })
      ).status,
      409,
    )
    assert.equal(
      (
        await f.request(`/towers/${id}/proposals/${p.id}/vote`, player.token, {
          choice: 'against',
        })
      ).status,
      200,
    )
    assert.equal(
      (
        await f.request(`/towers/${id}/proposals/${p.id}/decide`, owner.token, {
          accept: true,
          reason: 'Quero vetar',
        })
      ).status,
      403,
    )
    f.advance(101)
    const details = (await f.request(`/towers/${id}`)).data
    assert.equal(details.proposals[0].status, 'rejected')
    assert.equal(details.frame.blocks.length, 2)
  } finally {
    await f.close()
  }
})

test('successful vote restores the exact version and records a new event without refunding', async () => {
  const f = await fixture()
  try {
    const player = await f.register('restorevoter')
    const id = (
      await f.request('/towers', player.token, {
        name: 'Torre versão',
        minContributions: 1,
        cost: 2,
      })
    ).data.tower.id
    const snapshot = (await f.request(`/towers/${id}`)).data.snapshots[0].id
    assert.equal(
      (
        await f.request(`/towers/${id}/blocks`, player.token, {
          x: 400,
          y: 100,
        })
      ).status,
      200,
    )
    const proposal = (
      await f.request(`/towers/${id}/proposals`, player.token, {
        type: 'restore',
        targetId: snapshot,
        reason: 'Restaurar versão inicial',
      })
    ).data.proposal
    await f.request(
      `/towers/${id}/proposals/${proposal.id}/vote`,
      player.token,
      { choice: 'for' },
    )
    f.advance(101)
    const details = (await f.request(`/towers/${id}`)).data
    assert.equal(details.proposals[0].status, 'accepted')
    assert.equal(details.frame.blocks.length, 0)
    assert.equal(details.snapshots.length, 2)
    assert.equal(details.members[0].contributions, 1)
    assert.equal((await f.request('/me', player.token)).data.wallet.balance, 18)
    assert.ok(details.events.some((event) => event.type === 'vote-result'))
  } finally {
    await f.close()
  }
})

test('malformed requests, expired tokens and auth rate limits are rejected', async () => {
  const f = await fixture()
  try {
    const user = await f.register('limits')
    const bad = await fetch(`${f.base}/api/towers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{broken',
    })
    assert.equal(bad.status, 400)
    const oversize = await fetch(`${f.base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(17000) }),
    })
    assert.equal(oversize.status, 413)
    f.advance(8 * 24 * 60 * 60 * 1000)
    assert.equal((await f.request('/me', user.token)).status, 401)
    for (let attempt = 0; attempt < 15; attempt++)
      await f.request('/login', undefined, {
        email: 'none@example.org',
        password: 'wrong-password',
      })
    assert.equal(
      (
        await f.request('/login', undefined, {
          email: 'none@example.org',
          password: 'wrong-password',
        })
      ).status,
      429,
    )
  } finally {
    await f.close()
  }
})

test('settings require creator and a reason, log old/new rules and freeze during pending votes', async () => {
  const f = await fixture()
  try {
    const owner = await f.register('settingsowner')
    const outsider = await f.register('settingsguest')
    const id = (
      await f.request('/towers', owner.token, {
        name: 'Regras públicas',
        cost: 1,
      })
    ).data.tower.id
    const path = `/towers/${id}/settings`
    assert.equal(
      (
        await f.request(path, outsider.token, {
          cost: 0,
          reason: 'Quero acesso gratuito',
        })
      ).status,
      403,
    )
    assert.equal(
      (await f.request(path, owner.token, { cost: 0, reason: '' })).status,
      400,
    )
    assert.equal(
      (
        await f.request(path, owner.token, {
          cost: -1,
          reason: 'Custo inválido',
        })
      ).status,
      400,
    )
    assert.equal(
      (
        await f.request(path, owner.token, {
          cost: 0,
          eligibilityMode: 'manual',
          minContributions: 5,
          reason: 'Experimentar colaboração gratuita',
        })
      ).status,
      200,
    )
    let details = (await f.request(`/towers/${id}`)).data
    assert.equal(details.events.at(-1)!.type, 'settings')
    const proposal = (
      await f.request(`/towers/${id}/proposals`, owner.token, {
        type: 'restore',
        targetId: details.snapshots[0].id,
        reason: 'Propor estado inicial',
      })
    ).data.proposal
    assert.equal(
      (
        await f.request(path, owner.token, {
          cost: 2,
          reason: 'Alteração durante voto',
        })
      ).status,
      409,
    )
    await f.request(
      `/towers/${id}/proposals/${proposal.id}/vote`,
      owner.token,
      { choice: 'against' },
    )
    f.advance(101)
    assert.equal(
      (
        await f.request(path, owner.token, {
          cost: 2,
          reason: 'Revisar ritmo da torre',
        })
      ).status,
      200,
    )
  } finally {
    await f.close()
  }
})

test('database has one live writer, recovers a dead lock and releases ownership on close', async () => {
  const f = await fixture()
  try {
    assert.throws(() => createGameServer({ dbPath: f.dbPath }), /instância/)
    await f.game.close()
    const { spawn } = await import('node:child_process')
    const child = spawn(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import { createGameServer } from ${JSON.stringify(new URL('../game-server/server.ts', import.meta.url).href)};
      createGameServer({dbPath: ${JSON.stringify(f.dbPath)}});
      console.log('locked');
      setInterval(() => {}, 1000);
    `,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    await new Promise<void>((resolveReady, rejectReady) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        rejectReady(new Error('Child failed to acquire database lock'))
      }, 5000)
      child.stdout.once('data', () => {
        clearTimeout(timer)
        resolveReady()
      })
      child.once('error', (error) => {
        clearTimeout(timer)
        rejectReady(error)
      })
      child.once('exit', (code) => {
        clearTimeout(timer)
        if (code) rejectReady(new Error(`Child failed: ${code}`))
      })
    })
    assert.throws(() => createGameServer({ dbPath: f.dbPath }), /instância/)
    child.kill('SIGKILL')
    await new Promise<void>((resolveExit) =>
      child.once('exit', () => resolveExit()),
    )
    const recovered = createGameServer({ dbPath: f.dbPath })
    await recovered.close()
    const reopened = createGameServer({ dbPath: f.dbPath })
    await reopened.close()
  } finally {
    await f.close()
  }
})

test('restart clamps lowered wallet cap and keeps vote-change rules frozen', async () => {
  const f = await fixture()
  try {
    const user = await f.register('persistedrules')
    const id = (
      await f.request('/towers', user.token, { name: 'Regras congeladas' })
    ).data.tower.id
    const snapshot = (await f.request(`/towers/${id}`)).data.snapshots[0].id
    const proposal = (
      await f.request(`/towers/${id}/proposals`, user.token, {
        type: 'restore',
        targetId: snapshot,
        reason: 'Validar regras congeladas',
      })
    ).data.proposal
    await f.request(`/towers/${id}/proposals/${proposal.id}/vote`, user.token, {
      choice: 'for',
    })
    await f.game.close()
    const game = createGameServer({
      dbPath: f.dbPath,
      now: () => 100000,
      rules: { cap: 10, initialBalance: 10, voteChanges: true },
    })
    try {
      const base = await game.listen()
      const headers = {
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      }
      const me = await fetch(`${base}/api/me`, { headers })
      assert.equal(((await me.json()) as Data).wallet.balance, 10)
      const vote = await fetch(
        `${base}/api/towers/${id}/proposals/${proposal.id}/vote`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ choice: 'against' }),
        },
      )
      assert.equal(vote.status, 409)
    } finally {
      await game.close()
    }
  } finally {
    await f.close()
  }
})

test('creator suspension is opt-in at creation, immutable, limited to voting and persists', async () => {
  const f = await fixture()
  try {
    const owner = await f.register('suspensionowner')
    const guest = await f.register('suspensionguest')
    assert.equal(
      (
        await f.request('/towers', owner.token, {
          name: 'Opção inválida',
          allowCreatorBan: 'true',
        })
      ).status,
      400,
    )
    const protectedTower = (
      await f.request('/towers', owner.token, {
        name: 'Criador protegido',
      })
    ).data.tower
    assert.equal(protectedTower.allowCreatorBan, false)
    assert.equal(
      (
        await f.request(`/towers/${protectedTower.id}/proposals`, owner.token, {
          type: 'ban',
          targetId: owner.user.id,
          reason: 'Propor suspensão do criador',
        })
      ).status,
      400,
    )
    const bdfl = (
      await f.request('/towers', owner.token, {
        name: 'Criador BDFL',
        allowCreatorBan: true,
        banMode: 'bdfl',
      })
    ).data.tower
    assert.equal(
      (
        await f.request(`/towers/${bdfl.id}/proposals`, owner.token, {
          type: 'ban',
          targetId: owner.user.id,
          reason: 'Propor suspensão do criador',
        })
      ).status,
      400,
    )
    const tower = (
      await f.request('/towers', owner.token, {
        name: 'Criador sujeito a voto',
        allowCreatorBan: true,
        minContributions: 1,
        eligibilityMode: 'automatic',
      })
    ).data.tower
    assert.equal(tower.allowCreatorBan, true)
    for (const value of [false, true]) {
      assert.equal(
        (
          await f.request(`/towers/${tower.id}/settings`, owner.token, {
            allowCreatorBan: value,
            reason: 'Mudar decisão de criação',
          })
        ).status,
        400,
      )
    }
    assert.equal(
      (
        await f.request(`/towers/${tower.id}/blocks`, guest.token, {
          x: 300,
          y: 100,
        })
      ).status,
      200,
    )
    const proposal = (
      await f.request(`/towers/${tower.id}/proposals`, guest.token, {
        type: 'ban',
        targetId: owner.user.id,
        reason: 'Suspender criador por votação',
      })
    ).data.proposal
    assert.equal(proposal.electorate.length, 2)
    for (const token of [owner.token, guest.token]) {
      assert.equal(
        (
          await f.request(
            `/towers/${tower.id}/proposals/${proposal.id}/vote`,
            token,
            {
              choice: 'for',
            },
          )
        ).status,
        200,
      )
    }
    f.advance(101)
    const details = (await f.request(`/towers/${tower.id}`)).data
    assert.equal(details.proposals[0].status, 'accepted')
    assert.equal(details.tower.allowCreatorBan, true)
    for (const [suffix, body] of [
      ['blocks', { x: 500, y: 100 }],
      ['settings', { cost: 2, reason: 'Alterar custo suspenso' }],
      [`members/${guest.user.id}/eligibility`, { eligible: true }],
      [
        `proposals/${proposal.id}/decide`,
        { accept: false, reason: 'Tentar desfazer suspensão' },
      ],
    ] as const) {
      assert.equal(
        (await f.request(`/towers/${tower.id}/${suffix}`, owner.token, body))
          .status,
        403,
      )
    }
    await f.game.close()
    const restarted = createGameServer({ dbPath: f.dbPath, now: () => 100101 })
    try {
      const base = await restarted.listen()
      const response = await fetch(`${base}/api/towers/${tower.id}`)
      assert.equal(
        ((await response.json()) as Data).tower.allowCreatorBan,
        true,
      )
      const blocked = await fetch(`${base}/api/towers/${tower.id}/settings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${owner.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cost: 2,
          reason: 'Ainda suspenso após reinício',
        }),
      })
      assert.equal(blocked.status, 403)
    } finally {
      await restarted.close()
    }
  } finally {
    await f.close()
  }
})

test('restoring blocks preserves creator-suspension choice and legacy towers default to protected', async () => {
  const f = await fixture()
  try {
    const owner = await f.register('legacycreator')
    const tower = (
      await f.request('/towers', owner.token, {
        name: 'Escolha persistente',
        allowCreatorBan: true,
        restoreMode: 'bdfl',
      })
    ).data.tower
    const initial = (await f.request(`/towers/${tower.id}`)).data.snapshots[0]
      .id
    await f.request(`/towers/${tower.id}/blocks`, owner.token, {
      x: 400,
      y: 100,
    })
    const proposal = (
      await f.request(`/towers/${tower.id}/proposals`, owner.token, {
        type: 'restore',
        targetId: initial,
        reason: 'Restaurar somente os blocos',
      })
    ).data.proposal
    assert.equal(
      (
        await f.request(
          `/towers/${tower.id}/proposals/${proposal.id}/decide`,
          owner.token,
          {
            accept: true,
            reason: 'Preservar a regra definida na criação',
          },
        )
      ).status,
      200,
    )
    const restored = (await f.request(`/towers/${tower.id}`)).data
    assert.equal(restored.frame.blocks.length, 0)
    assert.equal(restored.tower.allowCreatorBan, true)
    await f.game.close()
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(f.dbPath)
    try {
      const value = db.prepare('SELECT value FROM game_state WHERE id=1').get()!
        .value as string
      const legacy = JSON.parse(value) as {
        towers: Record<string, { allowCreatorBan?: boolean }>
      }
      delete legacy.towers[tower.id].allowCreatorBan
      db.prepare('UPDATE game_state SET value=? WHERE id=1').run(
        JSON.stringify(legacy),
      )
    } finally {
      db.close()
    }
    const restarted = createGameServer({ dbPath: f.dbPath, now: () => 100000 })
    try {
      const base = await restarted.listen()
      const response = await fetch(`${base}/api/towers/${tower.id}`)
      assert.equal(
        ((await response.json()) as Data).tower.allowCreatorBan,
        false,
      )
    } finally {
      await restarted.close()
    }
  } finally {
    await f.close()
  }
})
