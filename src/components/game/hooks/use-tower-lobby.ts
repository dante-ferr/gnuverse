'use client'

import { useCallback, useEffect, useState } from 'react'
import { type GameApi } from '../api/game-api'
import { type Tower } from '../model/types'
export type Connection = 'connecting' | 'live' | 'offline'

export function useTowerLobby(api: GameApi) {
  const [towers, setTowers] = useState<Tower[]>([])
  const [towerId, setTowerId] = useState('')
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [total, setTotal] = useState(0)
  const [rules, setRules] = useState<Record<string, unknown> | null>(null)
  const [connection, setConnection] = useState<Connection>('connecting')
  const selectTower = useCallback((id: string) => {
    setTowerId(id)
    const url = new URL(window.location.href)
    url.searchParams.delete('novo')
    if (id) url.searchParams.set('id', id)
    else url.searchParams.delete('id')
    url.searchParams.delete('torre')
    window.history.replaceState(null, '', url)
  }, [])
  const refresh = useCallback(async (requestedPage = page) => {
    const [data, config] = await Promise.all([
      api.request<{ towers: Tower[]; page: number; pageCount: number; total: number }>(
        `/api/towers?page=${requestedPage}&limit=12`,
      ),
      api.request<{ rules: Record<string, unknown> }>('/api/rules'),
    ])
    setRules(config.rules)
    setTowers(data.towers)
    setPage(data.page)
    setPageCount(data.pageCount)
    setTotal(data.total)
    const params = new URLSearchParams(window.location.search)
    const requestedTower = params.get('torre') || params.get('id')
    setTowerId((current) => requestedTower || (
      data.towers.some((tower) => tower.id === current)
        ? current
        : data.towers[0]?.id || ''
    ))
  }, [api, page])
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
  return {
    towers, towerId, setTowerId: selectTower, rules, connection, refresh,
    page, pageCount, total,
    goToPage: (nextPage: number) => refresh(nextPage),
  }
}
