import assert from 'node:assert/strict'
import test from 'node:test'
import { PRESENCE_TTL_MS, RoomPresence } from '../game-server/runtime/room-presence.ts'

const ada = { id: 'a', nickname: 'ada' }

test('presence keeps the last edited cell while the player is present', () => {
  const presence = new RoomPresence()
  assert.equal(presence.touch('r', ada, 0), true)
  assert.equal(presence.touch('r', ada, 1000), false)
  presence.noteEdit('r', ada, { x: 1, y: 2 }, 2000)
  presence.noteEdit('r', ada, { x: 3, y: 4 }, 3000)
  assert.deepEqual(presence.snapshot('r'), [{ id: 'a', nickname: 'ada', cell: { x: 3, y: 4 } }])
})

test('presence drops players after heartbeats stop', () => {
  const presence = new RoomPresence()
  presence.noteEdit('r', ada, { x: 1, y: 1 }, 0)
  assert.deepEqual(presence.sweep(PRESENCE_TTL_MS), [])
  assert.deepEqual(presence.sweep(PRESENCE_TTL_MS + 1), ['r'])
  assert.deepEqual(presence.snapshot('r'), [])
})
