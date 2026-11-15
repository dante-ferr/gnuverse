import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_TOWER_FILTERS, listTowers } from '../src/components/game/api/list-towers.ts'
import type { Tower } from '../src/components/game/model/types.ts'

const towers: Tower[] = Array.from({ length: 63 }, (_, index) => ({
  id: String(index),
  name: `Torre ${String(index).padStart(2, '0')}`,
  creatorId: index % 2 ? 'other' : 'owner',
  cost: index % 3,
  segmentCount: index,
  allowCreatorBan: false,
  eligibilityMode: 'automatic',
  minContributions: 1,
}))
towers[62] = { ...towers[62], name: 'Árvore livre' }

function legacyApi() {
  const paths: string[] = []
  return {
    paths,
    async request<T>(path: string): Promise<T> {
      paths.push(path)
      const params = new URL(path, 'http://localhost').searchParams
      const limit = Number(params.get('limit'))
      const page = Number(params.get('page'))
      return {
        towers: towers.slice((page - 1) * limit, page * limit),
        total: towers.length,
        page,
        pageCount: Math.ceil(towers.length / limit),
      } as T
    },
  }
}

test('search finds matches on later pages when the API ignores query filters', async () => {
  const api = legacyApi()
  const result = await listTowers(api, { ...DEFAULT_TOWER_FILTERS, search: ' ARVORE ' }, 1)
  assert.deepEqual(result.towers.map((tower) => tower.id), ['62'])
  assert.equal(result.total, 1)
  assert.equal(result.pageCount, 1)
  assert.ok(api.paths.includes('/api/towers?page=2&limit=50'))
  const empty = await listTowers(api, { ...DEFAULT_TOWER_FILTERS, search: 'inexistente' }, 4)
  assert.deepEqual(empty.towers, [])
  assert.equal(empty.total, 0)
  assert.equal(empty.page, 1)
})

test('legacy API results are filtered and sorted globally before pagination', async () => {
  const result = await listTowers(legacyApi(), {
    search: 'torre',
    cost: 'paid',
    sort: 'segments-desc',
    mine: true,
  }, 2, 'owner')
  const expected = towers
    .filter(
      (tower) =>
        tower.creatorId === 'owner' && tower.cost > 0 && tower.name.includes('Torre'),
    )
    .sort((a, b) => b.segmentCount - a.segmentCount)
  assert.equal(result.total, expected.length)
  assert.equal(result.page, 2)
  assert.deepEqual(result.towers, expected.slice(12, 24))
  for (const sort of ['name', 'cost-asc', 'cost-desc', 'segments-desc'] as const) {
    const ordered = await listTowers(legacyApi(), { ...DEFAULT_TOWER_FILTERS, sort }, 1)
    const compare =
      sort === 'name'
        ? (a: Tower, b: Tower) => a.name.localeCompare(b.name, 'pt-BR')
        : sort === 'cost-asc'
          ? (a: Tower, b: Tower) => a.cost - b.cost
          : sort === 'cost-desc'
            ? (a: Tower, b: Tower) => b.cost - a.cost
            : (a: Tower, b: Tower) => b.segmentCount - a.segmentCount
    assert.deepEqual(ordered.towers, [...towers].sort(compare).slice(0, 12))
  }
  const free = await listTowers(legacyApi(), { ...DEFAULT_TOWER_FILTERS, cost: 'free' }, 1)
  assert.equal(free.total, 21)
  assert.ok(free.towers.every((tower) => tower.cost === 0))
})

test('my towers never returns another account’s towers or anonymous results', async () => {
  const filters = { ...DEFAULT_TOWER_FILTERS, mine: true }
  const own = await listTowers(legacyApi(), filters, 1, 'other')
  assert.ok(own.towers.every((tower) => tower.creatorId === 'other'))
  const none = await listTowers(legacyApi(), filters, 1)
  assert.deepEqual(none.towers, [])
  assert.equal(none.total, 0)
})