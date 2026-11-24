'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameApi } from '../../api/game-api'
import { isPipelineFrame, type PipelineFrame } from '../model/frame'
import type { Connection } from '../../hooks/use-room-lobby'
import type {
  ChatMessage,
  Checkpoint,
  GameEvent,
  Member,
  Proposal,
  RoomGovernance,
} from '../../model/types'

const emptyFrame = (): PipelineFrame => ({
  kind: 'pipeline',
  version: '0.1',
  seed: '',
  width: 24,
  height: 24,
  tick: 0,
  deliveries: 0,
  deliveryByShape: {},
  demands: [{ shape: 'circle', received: 0, required: 0 }],
  collaborators: [],
  belts: [],
  packets: [],
  source: { id: 'source', x: 0, y: 0, direction: 'east', shape: 'circle' },
  core: { id: 'core', x: 0, y: 0 },
  originChunk: { cx: 0, cy: 0 },
  ownedChunks: [{ cx: 0, cy: 0 }],
  previewChunks: [],
  sources: [{ id: 'source', x: 0, y: 0, direction: 'east', shape: 'circle' }],
})

const defaultGovernance: RoomGovernance = {
  restoreByMajority: false,
  banByMajority: false,
  checkpointSpend: 0,
}

/** SSE frames, chat, and room detail for one pipeline room. */
export function usePipelineStream(api: GameApi, roomId: string) {
  const [frame, setFrame] = useState<PipelineFrame>(emptyFrame)
  const [rules, setRules] = useState<Record<string, unknown> | null>(null)
  const [name, setName] = useState('')
  const [creatorId, setCreatorId] = useState('')
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [events, setEvents] = useState<GameEvent[]>([])
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [governance, setGovernance] = useState<RoomGovernance>(defaultGovernance)
  const [connection, setConnection] = useState<Connection>('connecting')
  const selected = useRef(roomId)
  selected.current = roomId
  const refresh = useCallback(async () => {
    if (!roomId) return
    const result = await api.request<{
      room: { id: string; name: string; creatorId: string } & Partial<RoomGovernance>
      snapshots?: Checkpoint[]
      frame: PipelineFrame
      rules: Record<string, unknown>
      chat?: ChatMessage[]
      members?: Member[]
      proposals?: Proposal[]
      events?: GameEvent[]
    }>(`/api/rooms/${roomId}`)
    if (selected.current !== result.room.id || !isPipelineFrame(result.frame)) return
    setFrame((current) => (result.frame.tick >= current.tick ? result.frame : current))
    setRules(result.rules)
    setName(result.room.name)
    setCreatorId(result.room.creatorId)
    setChat(Array.isArray(result.chat) ? result.chat : [])
    setMembers(Array.isArray(result.members) ? result.members : [])
    setProposals(Array.isArray(result.proposals) ? result.proposals : [])
    setEvents(Array.isArray(result.events) ? result.events : [])
    setCheckpoints(Array.isArray(result.snapshots) ? result.snapshots : [])
    setGovernance({
      restoreByMajority: result.room.restoreByMajority === true,
      banByMajority: result.room.banByMajority === true,
      checkpointSpend: Number(result.room.checkpointSpend ?? 0),
    })
  }, [api, roomId])
  useEffect(() => {
    setFrame(emptyFrame())
    setChat([])
    setMembers([])
    setProposals([])
    setEvents([])
    setCheckpoints([])
    setGovernance(defaultGovernance)
    setConnection('connecting')
    if (!roomId) return
    let active = true
    const update = () =>
      refresh().catch(() => {
        if (active) setConnection('offline')
      })
    void update()
    const stream = api.stream(roomId)
    stream.onopen = () => {
      if (active) setConnection('live')
    }
    stream.onerror = () => {
      if (active) setConnection('offline')
    }
    const onFrame = (event: MessageEvent<string>) => {
      if (!active) return
      try {
        const data = JSON.parse(event.data) as PipelineFrame & {
          omitBelts?: boolean
          beltCount?: number
        }
        if (!isPipelineFrame(data)) return
        if (data.omitBelts) {
          const { omitBelts: _omit, beltCount, ...rest } = data
          let mismatch = false
          setFrame((current) => {
            if (beltCount !== undefined && current.belts.length !== beltCount) {
              mismatch = true
              return current
            }
            return { ...rest, belts: current.belts }
          })
          if (mismatch) void update()
        } else {
          setFrame(data)
        }
        setConnection('live')
      } catch {
        setConnection('offline')
      }
    }
    stream.addEventListener('frame', onFrame)
    const onChat = (event: MessageEvent<string>) => {
      if (!active) return
      try {
        const data = JSON.parse(event.data) as { chat?: ChatMessage[] }
        if (Array.isArray(data.chat)) setChat(data.chat)
      } catch {
        /* ignore malformed chat payloads */
      }
    }
    stream.addEventListener('chat', onChat)
    stream.addEventListener('change', () => {
      if (active) void update()
    })
    return () => {
      active = false
      stream.removeEventListener('chat', onChat)
      stream.removeEventListener('frame', onFrame)
      stream.close()
    }
  }, [api, roomId, refresh])
  return {
    frame,
    rules,
    name,
    creatorId,
    chat,
    members,
    proposals,
    events,
    checkpoints,
    governance,
    connection,
    refresh,
  }
}
