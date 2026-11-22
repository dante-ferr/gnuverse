import assert from 'node:assert/strict'
import test from 'node:test'
import { Packet } from '../game-server/pipeline/packets/packet.ts'
import { TrashcanMachine } from '../game-server/pipeline/machines/trashcan-machine.ts'
import { ahead, opposite } from '../game-server/pipeline/geometry/direction.ts'
import { Match } from '../game-server/pipeline/world/match.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'

const rules = testPipelineRules()
const author = { id: 'u1', nickname: 'Ada' }

function sandboxWithTrashcan(
  origin = { x: 25, y: 24 },
  facing: 'east' | 'north' = 'east',
  viaApi = true,
) {
  const match = Match.createSandbox('trashcan', rules)
  if (viaApi) {
    const error = match.placeMachine(
      { machineId: 'trashcan', x: origin.x, y: origin.y, facing },
      author,
    )
    assert.equal(error, null)
    return { match, origin, trashcan: match.trashcans[0]! }
  }
  const trashcan = new TrashcanMachine('tc1', origin, facing, author)
  match.trashcans.push(trashcan)
  return { match, origin, trashcan }
}

test('placeMachine accepts trashcan with 2×2 and one input', () => {
  const { trashcan } = sandboxWithTrashcan()
  assert.equal(trashcan.width, 2)
  assert.equal(trashcan.height, 2)
  assert.equal(trashcan.inputSlots().length, 1)
  assert.equal(trashcan.outputSlots().length, 0)
})

test('belt into approach destroys packet without delivery score', () => {
  const { match, trashcan } = sandboxWithTrashcan()
  const input = trashcan.inputSlots()[0]!
  const approach = ahead(input.cell.x, input.cell.y, opposite(input.travel))
  assert.equal(
    match.place([{ ...approach, direction: 'east' }], author),
    null,
  )
  const deliveriesBefore = match.deliveries
  match.packets.push(new Packet('p1', approach, 'circle'))
  match.tick()
  assert.equal(match.packets.length, 0)
  assert.equal(match.deliveries, deliveriesBefore)
})

test('rejects overlapping trashcan footprint', () => {
  const { match } = sandboxWithTrashcan({ x: 25, y: 24 })
  const error = match.placeMachine(
    { machineId: 'trashcan', x: 26, y: 24, facing: 'east' },
    author,
  )
  assert.equal(error, 'Espaço ocupado por outra estrutura.')
})

test('remove deletes trashcan under clicked cell', () => {
  const { match, origin } = sandboxWithTrashcan()
  const result = match.remove({ x: origin.x, y: origin.y }, author)
  assert.equal(result.error, null)
  assert.equal(result.kind, 'trashcan')
  assert.equal(match.trashcans.length, 0)
})