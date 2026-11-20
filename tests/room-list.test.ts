import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ROOM_FILTERS, listRooms } from '../src/components/game/api/list-rooms.ts'
import type { Room } from '../src/components/game/model/types.ts'

const rooms: Room[] = Array.from({ length: 63 }, (_, index) => ({
  id: String(index),
  name: `Sala ${String(index).padStart(2, '0')}`,
  creatorId: index % 2 ? 'other' : 'owner',
  cost: 0,
  beltCount: index,
  allowCreatorBan: false,
  eligibilityMode: 'automatic',
  minContributions: 1,
}))
rooms[62] = { ...rooms[62], name: 'Sala livre' }

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
        rooms: rooms.slice((page - 1) * limit, page * limit),
        total: rooms.length,
        page,
        pageCount: Math.ceil(rooms.length / limit),
      } as T
    },
  }
}

test('search finds matches on later pages when the API ignores query filters', async () => {
  const api = legacyApi()
  const result = await listRooms(api, { ...DEFAULT_ROOM_FILTERS, search: ' LIVRE ' }, 1)
  assert.deepEqual(result.rooms.map((room) => room.id), ['62'])
  assert.equal(result.total, 1)
  assert.equal(result.pageCount, 1)
  assert.ok(api.paths.includes('/api/towers?page=2&limit=50'))
  const empty = await listRooms(api, { ...DEFAULT_ROOM_FILTERS, search: 'inexistente' }, 4)
  assert.deepEqual(empty.rooms, [])
  assert.equal(empty.total, 0)
  assert.equal(empty.page, 1)
})

test('legacy API results are filtered and sorted globally before pagination', async () => {
  const result = await listRooms(legacyApi(), {
    search: 'sala',
    sort: 'belts-desc',
    mine: true,
  }, 2, 'owner')
  const expected = rooms
    .filter(
      (room) =>
        room.creatorId === 'owner' && room.name.toLocaleLowerCase('pt-BR').includes('sala'),
    )
    .sort((a, b) => b.beltCount - a.beltCount)
  assert.equal(result.total, expected.length)
  assert.equal(result.page, 2)
  assert.deepEqual(result.rooms, expected.slice(12, 24))
  for (const sort of ['name', 'belts-desc'] as const) {
    const ordered = await listRooms(legacyApi(), { ...DEFAULT_ROOM_FILTERS, sort }, 1)
    const compare =
      sort === 'name'
        ? (a: Room, b: Room) => a.name.localeCompare(b.name, 'pt-BR')
        : (a: Room, b: Room) => b.beltCount - a.beltCount
    assert.deepEqual(ordered.rooms, [...rooms].sort(compare).slice(0, 12))
  }
})

test('my rooms never returns another account’s rooms or anonymous results', async () => {
  const filters = { ...DEFAULT_ROOM_FILTERS, mine: true }
  const own = await listRooms(legacyApi(), filters, 1, 'other')
  assert.ok(own.rooms.every((room) => room.creatorId === 'other'))
  const none = await listRooms(legacyApi(), filters, 1)
  assert.deepEqual(none.rooms, [])
  assert.equal(none.total, 0)
})
