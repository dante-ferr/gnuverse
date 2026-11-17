'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type GameApi } from '../api/game-api'
import { type Tower } from '../model/types'
import { DEFAULT_TOWER_FILTERS, listTowers, type TowerFilters } from '../api/list-towers'
export { DEFAULT_TOWER_FILTERS, type TowerFilters } from '../api/list-towers'
export type Connection = 'connecting' | 'live' | 'offline'

export function useTowerLobby(api: GameApi, userId?: string) {
  const [towers, setTowers] = useState<Tower[]>([])
  const [towerId, setTowerId] = useState('')
  const [{ page, filters }, setQuery] = useState({ page: 1, filters: DEFAULT_TOWER_FILTERS })
  const requestId = useRef(0)
  const setFilters = useCallback((changes: Partial<TowerFilters>) => {
    requestId.current++
    setTowers([])
    setTotal(0)
    setPageCount(1)
    setConnection('connecting')
    setQuery((current) => ({ page: 1, filters: { ...current.filters, ...changes } }))
  }, [])
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
    const id = ++requestId.current
    const [data, config] = await Promise.all([
      listTowers(api, filters, requestedPage, userId),
      api.request<{ rules: Record<string, unknown> }>('/api/rules'),
    ])
    if (id !== requestId.current) return
    setRules(config.rules)
    setTowers(data.towers)
    setQuery((current) => current.page === data.page ? current : { ...current, page: data.page })
    setPageCount(data.pageCount)
    setTotal(data.total)
    const locationParams = new URLSearchParams(window.location.search)
    const requestedTower = locationParams.get('torre') || locationParams.get('id')
    setTowerId((current) => requestedTower || (
      data.towers.some((tower) => tower.id === current)
        ? current
        : data.towers[0]?.id || ''
    ))
  }, [api, page, filters, userId])
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
      requestId.current++
      clearInterval(interval)
    }
  }, [refresh])
  return {
    towers, towerId, setTowerId: selectTower, rules, connection, refresh,
    page, pageCount, total,
    filters, setFilters,
    goToPage: (nextPage: number) => {
      requestId.current++
      setConnection('connecting')
      setQuery((current) => ({ ...current, page: nextPage }))
    },
  }
}
