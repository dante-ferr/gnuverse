import assert from 'node:assert/strict'
import test from 'node:test'
import {
  defaultStructureId,
  getStructure,
  listStructures,
  registerStructure,
  type StructureDefinition,
} from '../src/components/game/pipeline/structures/index.ts'

test('registered structures appear in sidebar order and place through commit', async () => {
  assert.equal(defaultStructureId(), 'belt')
  const belt = getStructure('belt')
  assert.ok(belt)
  assert.equal(belt.label, 'Esteira')
  assert.equal(belt.iconSrc, '/pipeline/structure-belt.svg')
  assert.ok(listStructures().some((item) => item.id === 'belt'))

  const session = belt.createSession()
  session.push({ x: 1, y: 2 })
  session.push({ x: 2, y: 2 })
  const request = session.finish()
  assert.ok(request)
  assert.equal(request.structureId, 'belt')

  let placed: unknown = null
  await belt.commit(
    {
      roomId: 'room-1',
      request: async (path, body) => {
        placed = { path, body }
        return {}
      },
    },
    request.payload,
  )
  assert.deepEqual(placed, {
    path: '/api/rooms/room-1/place',
    body: {
      cells: [
        { x: 1, y: 2, direction: 'east' },
        { x: 2, y: 2, direction: 'east' },
      ],
    },
  })
})

test('registerStructure updates listStructures without hardcoding the palette', () => {
  const probe: StructureDefinition = {
    id: `probe-${Date.now()}`,
    label: 'Sonda',
    iconSrc: '/pipeline/structure-belt.svg',
    signInMessage: 'Entre para colocar sondas.',
    createSession: () => ({
      push: () => false,
      previewBelts: () => [],
      isEmpty: () => true,
      finish: () => null,
    }),
    commit: async () => {},
  }
  registerStructure(probe)
  assert.ok(listStructures().some((item) => item.id === probe.id))
  assert.equal(getStructure(probe.id)?.label, 'Sonda')
})
