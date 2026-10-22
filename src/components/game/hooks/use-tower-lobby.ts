'use client'

import { useCallback, useEffect, useState } from 'react'
import { type GameApi } from '../api/game-api'
import { type Tower } from '../model/types'
export type Connection = 'connecting' | 'live' | 'offline'

export function useTowerLobby(api: GameApi) {
  const [towers, setTowers] = useState<Tower[]>([])
  const [towerId, setTowerId] = useState('')
  const [rules, setRules] = useState<Record<string, unknown> | null>(null)
  const [connection, setConnection] = useState<Connection>('connecting')
  const refresh = useCallback(async () => {
    const [data, config] = await Promise.all([
      api.request<{ towers: Tower[] }>('/api/towers'),
      api.request<{ rules: Record<string, unknown> }>('/api/rules'),
    ])
    setRules(config.rules)
    setTowers(data.towers)
    setTowerId((current) =>
      data.towers.some((tower) => tower.id === current)
        ? current
        : data.towers[0]?.id || '',
    )
  }, [api])
  useEffect(() => {
    let active = true
    const update = () =>
      refresh()
        .then(() => {
          if (active) setConnection('live')
        })
        .catch(() => {
          if (active) setConnection('offline')
        })
    void update()
    const interval = setInterval(update, 10000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [refresh])
  return { towers, towerId, setTowerId, rules, connection, refresh }
}
