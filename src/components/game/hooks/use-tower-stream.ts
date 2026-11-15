'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type GameApi } from '../api/game-api'
import { type TowerState, type TreeFrame } from '../model/types'
import { type Connection } from './use-tower-lobby'
const emptyFrame = (): TreeFrame => ({
  nodes: [],
  energy: 0,
  turn: { phase: 'idle', phaseEndsAt: null },
  firefly: { path: [], index: 0, active: false, phasesSeen: 0 },
  flower: { bloomed: false, nodeId: null, energyPhasesAboveZero: 0 },
  outcome: 'playing',
  exit: { x: 320, y: 0, width: 160, height: 80 },
  tick: 0,
})

/** Owns the SSE lifecycle and guards responses from a previously selected tower. */
export function useTowerStream(api: GameApi, towerId: string) {
  const [state, setState] = useState<TowerState | null>(null)
  const [frame, setFrame] = useState<TreeFrame>(emptyFrame)
  const [connection, setConnection] = useState<Connection>('connecting')
  const selected = useRef(towerId)
  selected.current = towerId
  const refresh = useCallback(async () => {
    if (!towerId) return
    const result = await api.request<TowerState>(`/api/towers/${towerId}`)
    if (selected.current === result.tower.id) setState(result)
    return result
  }, [api, towerId])
  useEffect(() => {
    setState(null)
    setFrame(emptyFrame())
    setConnection('connecting')
    if (!towerId) return
    let active = true
    const update = () =>
      refresh()
        .then((data) => {
          if (active && data)
            setFrame((current) =>
              data.frame.tick >= current.tick ? data.frame : current,
            )
        })
        .catch(() => {
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
        const data = JSON.parse(event.data) as TreeFrame
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
    const interval = setInterval(update, 3000)
    return () => {
      active = false
      stream.close()
      clearInterval(interval)
    }
  }, [api, towerId, refresh])
  return { state, frame, connection, refresh, setFrame }
}