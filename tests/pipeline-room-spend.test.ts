import assert from 'node:assert/strict'
import test from 'node:test'
import { Match } from '../game-server/pipeline/world/match.ts'
import { recordRoomSpend } from '../game-server/economy/room-spend.ts'
import { testPipelineRules } from './helpers/pipeline-rules.ts'
import { RoomService } from '../game-server/rooms/room-service.ts'

test('spentByUserId round-trips on the frame', () => {
  const match = Match.create('spend-frame', testPipelineRules())
  recordRoomSpend(match, 'u1', 12)
  recordRoomSpend(match, 'u2', 3)
  recordRoomSpend(match, 'u1', 5)
  const restored = Match.fromFrame(match.toFrame(), match.rules)
  assert.equal(restored.spentByUserId.u1, 17)
  assert.equal(restored.spentByUserId.u2, 3)
})

test('publicRoom exposes deliveries score', () => {
  const frame = Match.create('lobby-score', testPipelineRules()).toFrame()
  frame.deliveries = 42
  const room = {
    id: 'r1',
    name: 'Sala',
    creatorId: 'c',
    cost: 0,
    eligibilityMode: 'automatic' as const,
    minContributions: 1,
    actionCount: 0,
    frame,
    members: {},
    events: [],
    snapshots: [],
    proposals: [],
    allowCreatorBan: false,
    chat: [],
    beltCount: 0,
  }
  const rooms = new RoomService(
    { state: { rooms: {} } } as never,
    { pipeline: testPipelineRules(), maxRooms: 1, maxRoomsPerCreator: 1, chatCooldownMs: 0, chatHistoryLimit: 1, chatMessageMaxLength: 100, startingBalance: 0, startingPassiveCap: 0 } as never,
    () => 0,
    { read: () => ({ balance: 0 }), spend: () => ({ balance: 0 }), credit: () => ({ balance: 0 }) } as never,
    { publicFrame: (r: { frame: unknown }) => r.frame, afterAction: () => {}, remove: () => {}, publishChat: () => {} } as never,
    { event: () => {} } as never,
  )
  assert.equal(rooms.publicRoom(room).deliveries, 42)
})