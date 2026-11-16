'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameApi } from '../../api/game-api'
import { isPipelineFrame, type PipelineFrame } from '../model/frame'
import type { Connection } from '../../hooks/use-tower-lobby'

const emptyFrame = (): PipelineFrame => ({
  kind: 'pipeline',
  version: '0.1',
  seed: '',
  width: 24,
  height: 24,
  tick: 0,
  crashed: false,
  stability: 0,
  deliveries: 0,
  graceRemaining: 0,
  collaborators: [],
  belts: [],
  packets: [],
  source: { id: 'source', x: 0, y: 0, direction: 'east' },
  core: { id: 'core', x: 0, y: 0 },
})

/** SSE frames for one pipeline room. */
export function usePipelineStream(api: GameApi, towerId: string) {
  const [frame, setFrame] = useState<PipelineFrame>(emptyFrame)
  const [rules, setRules] = useState<Record<string, unknown> | null>(null)
  const [name, setName] = useState('')
  const [creatorId, setCreatorId] = useState('')
  const [connection, setConnection] = useState<Connection>('connecting')
  const selected = useRef(towerId)
  selected.current = towerId
  const refresh = useCallback(async () => {
    if (!towerId) return
    const result = await api.request<{
      tower: { id: string; name: string; creatorId: string }
      frame: PipelineFrame
      rules: Record<string, unknown>
      members: { id: string; banned: boolean }[]
    }>(`/api/towers/${towerId}`)
    if (selected.current !== result.tower.id || !isPipelineFrame(result.frame)) return
    setFrame((current) => (result.frame.tick >= current.tick ? result.frame : current))
    setRules(result.rules)
    setName(result.tower.name)
    setCreatorId(result.tower.creatorId)
  }, [api, towerId])
  useEffect(() => {
    setFrame(emptyFrame())
    setConnection('connecting')
    if (!towerId) return
    let active = true
    const update = () =>
      refresh().catch(() => {
        if (active) setConnection('offline')
      })
    void update()
    const stream = api.stream(towerId)
    stream.onopen = () => {
      if (active) setConnection('live')
    }
    stream.onerror = () => {
      if (active) setConnection('offline')
    }
    const onFrame = (event: MessageEvent<string>) => {
      if (!active) return
      try {
        const data = JSON.parse(event.data) as PipelineFrame
        if (!isPipelineFrame(data)) return
        setFrame(data)
        setConnection('live')
      } catch {
        setConnection('offline')
      }
    }
    stream.addEventListener('frame', onFrame)
    stream.addEventListener('change', () => {
      if (active) void update()
    })
    return () => {
      active = false
      stream.close()
    }
  }, [api, towerId, refresh])
  return { frame, rules, name, creatorId, connection, refresh }
}
