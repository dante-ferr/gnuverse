'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type GameApi } from '../api/game-api'
import { type Room } from '../model/types'
import { DEFAULT_ROOM_FILTERS, listRooms, type RoomFilters } from '../api/list-rooms'
export { DEFAULT_ROOM_FILTERS, type RoomFilters } from '../api/list-rooms'
export type Connection = 'connecting' | 'live' | 'offline'

export function useRoomLobby(api: GameApi, userId?: string) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomId, setRoomId] = useState('')
  const [{ page, filters }, setQuery] = useState({ page: 1, filters: DEFAULT_ROOM_FILTERS })
  const requestId = useRef(0)
  const setFilters = useCallback((changes: Partial<RoomFilters>) => {
    requestId.current++
    setRooms([])
    setTotal(0)
    setPageCount(1)
    setConnection('connecting')
    setQuery((current) => ({ page: 1, filters: { ...current.filters, ...changes } }))
  }, [])
  const [pageCount, setPageCount] = useState(1)
  const [total, setTotal] = useState(0)
  const [rules, setRules] = useState<Record<string, unknown> | null>(null)
  const [connection, setConnection] = useState<Connection>('connecting')
  const selectRoom = useCallback((id: string) => {
    setRoomId(id)
    const url = new URL(window.location.href)
    url.searchParams.delete('novo')
    if (id) url.searchParams.set('id', id)
    else url.searchParams.delete('id')
    window.history.replaceState(null, '', url)
  }, [])
  const refresh = useCallback(async (requestedPage = page) => {
    const id = ++requestId.current
    const [data, config] = await Promise.all([
      listRooms(api, filters, requestedPage, userId),
      api.request<{ rules: Record<string, unknown> }>('/api/rules'),
    ])
    if (id !== requestId.current) return
    setRules(config.rules)
    setRooms(data.rooms)
    setQuery((current) => current.page === data.page ? current : { ...current, page: data.page })
    setPageCount(data.pageCount)
    setTotal(data.total)
    const locationParams = new URLSearchParams(window.location.search)
    const requestedRoom = locationParams.get('id')
    setRoomId((current) => requestedRoom || (
      data.rooms.some((room) => room.id === current)
        ? current
        : data.rooms[0]?.id || ''
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
    rooms, roomId, setRoomId: selectRoom, rules, connection, refresh,
    page, pageCount, total,
    filters, setFilters,
    goToPage: (nextPage: number) => {
      requestId.current++
      setConnection('connecting')
      setQuery((current) => ({ ...current, page: nextPage }))
    },
  }
}