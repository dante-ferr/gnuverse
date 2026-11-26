import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGameServer } from '../game-server/server.ts'
import type { ContentCatalog } from '../game-server/economy/content-catalog.ts'
import { createTestIdentityProvider } from './helpers/identity-provider.ts'

const catalog: ContentCatalog = {
  async hasArticle(slug) {
    return slug === 'software-livre'
  },
  async quiz(slug) {
    if (slug !== 'quiz-um') return null
    return {
      slug,
      questions: [
        { prompt: 'Primeira?', correctAnswer: 1, choiceCount: 3 },
        { prompt: 'Segunda?', correctAnswer: 0, choiceCount: 2 },
      ],
    }
  },
}

test('reading and quiz rewards fill the uncapped reward wallet once per item', async () => {
  let time = 1_000_000
  const folder = await mkdtemp(join(tmpdir(), 'gnuverse-rewards-'))
  const game = createGameServer({
    identityProvider: createTestIdentityProvider({ now: () => time }),
    dbPath: join(folder, 'game.sqlite'),
    now: () => time,
    contentCatalog: catalog,
    rules: {
      initialBalance: 5,
      pipeline: {
        passiveCap: 5,
        walletCap: 10_000,
        rewardArticleReadCoins: 25,
        rewardArticleMinReadSeconds: 45,
        rewardQuizCorrectCoins: 10,
        rewardQuizPerfectBonusCoins: 20,
      },
    },
  })
  const base = await game.listen()
  try {
    const register = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'leitor', email: 'leitor@example.org', password: 'test-password-123' }),
    })
    const { token } = (await register.json()) as { token: string }
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const post = (path: string, body: unknown) =>
      fetch(`${base}/api/rewards/${path}`, { method: 'POST', headers, body: JSON.stringify(body) })

    assert.equal((await fetch(`${base}/api/rewards/article/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401)
    assert.equal((await post('article/open', { slug: 'inexistente' })).status, 404)
    assert.equal((await post('article/claim', { slug: 'software-livre' })).status, 409)

    assert.equal((await post('article/open', { slug: 'software-livre' })).status, 200)
    assert.equal((await post('article/claim', { slug: 'software-livre' })).status, 425)
    time += 46_000
    const read = await post('article/claim', { slug: 'software-livre' })
    assert.equal(read.status, 200)
    const readBody = (await read.json()) as { awarded: number; wallet: { balance: number; rewardBalance: number } }
    assert.equal(readBody.awarded, 25)
    assert.equal(readBody.wallet.balance, 5)
    assert.equal(readBody.wallet.rewardBalance, 25)
    const again = (await (await post('article/claim', { slug: 'software-livre' })).json()) as { awarded: number }
    assert.equal(again.awarded, 0)

    assert.equal((await post('quiz/claim', { slug: 'quiz-um', answers: [1] })).status, 400)
    const first = (await (await post('quiz/claim', { slug: 'quiz-um', answers: [1, 1] })).json()) as {
      correct: number; awarded: number; bonus: number; wallet: { rewardBalance: number }
    }
    assert.deepEqual([first.correct, first.awarded, first.bonus, first.wallet.rewardBalance], [1, 10, 0, 35])
    const second = (await (await post('quiz/claim', { slug: 'quiz-um', answers: [1, 0] })).json()) as {
      awarded: number; bonus: number; wallet: { rewardBalance: number; spendable: number }
    }
    assert.deepEqual([second.awarded, second.bonus, second.wallet.rewardBalance], [30, 20, 65])
    const replay = (await (await post('quiz/claim', { slug: 'quiz-um', answers: [1, 0] })).json()) as { awarded: number }
    assert.equal(replay.awarded, 0)

    const me = (await (await fetch(`${base}/api/me`, { headers })).json()) as { wallet: { spendable: number } }
    assert.equal(me.wallet.spendable, 70)
  } finally {
    await game.close()
  }
})
