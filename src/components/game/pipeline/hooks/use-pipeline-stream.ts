'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameApi } from '../../api/game-api'
import { isPipelineFrame, type PipelineFrame, type PresencePlayer } from '../model/frame'
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
  const [presence, setPresence] = useState<PresencePlayer[]>([])
  const [connection, setConnection] = useState<Connection>('connecting')
  const selected = useRef(roomId)
  selected.current = roomId
  const beltCountRef = useRef(0)
  beltCountRef.current = frame.belts.length
  /** Show a frame an edit response returned without waiting for the next room refetch. */
  const applyFrame = useCallback((next: unknown) => {
    if (!isPipelineFrame(next)) return
    setFrame((current) => (next.tick >= current.tick ? next : current))
  }, [])
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
    applyFrame(result.frame)
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
  }, [api, roomId, applyFrame])
  useEffect(() => {
    setFrame(emptyFrame())
    setChat([])
    setMembers([])
    setProposals([])
    setEvents([])
    setCheckpoints([])
    setGovernance(defaultGovernance)
    setPresence([])
    setConnection('connecting')
    if (!roomId) return
    let active = true
    // One room-detail fetch at a time; a burst of `change` events collapses into one trailing refetch.
    let fetching = false
    let again = false
    const update = () => {
      if (fetching) {
        again = true
        return
      }
      fetching = true
      refresh()
        .catch(() => {
          if (active) setConnection('offline')
        })
        .finally(() => {
          fetching = false
          if (again && active) {
            again = false
            update()
          }
        })
    }
    update()
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
          // Updaters run lazily, so check the belt count against a ref, not inside setFrame.
          if (beltCount !== undefined && beltCountRef.current !== beltCount) {
            update()
            return
          }
          setFrame((current) => ({ ...rest, belts: current.belts }))
        } else {
          beltCountRef.current = data.belts.length
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
    const onPresence = (event: MessageEvent<string>) => {
      if (!active) return
      try {
        const data = JSON.parse(event.data) as { players?: PresencePlayer[] }
        if (Array.isArray(data.players)) setPresence(data.players)
      } catch {
        /* ignore malformed presence payloads */
      }
    }
    stream.addEventListener('presence', onPresence)
    stream.addEventListener('change', () => {
      if (active) update()
    })
    return () => {
      active = false
      stream.removeEventListener('chat', onChat)
      stream.removeEventListener('presence', onPresence)
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
    presence,
    refresh,
    applyFrame,
  }
}
