import type { GameApi } from './game-api'
import type { Room } from '../model/types'

export type RoomFilters = {
  search: string
  sort: 'oldest' | 'name' | 'belts-desc' | 'score-desc'
  mine: boolean
}
export const DEFAULT_ROOM_FILTERS: RoomFilters = {
  search: '', sort: 'oldest', mine: false,
}

type RoomPage = {
  rooms: Room[]
  page: number
  pageCount: number
  total: number
  filtersApplied?: boolean
}

export async function listRooms(
  api: Pick<GameApi, 'request'>,
  filters: RoomFilters,
  page: number,
  userId?: string,
): Promise<RoomPage> {
  const limit = 12
  if (filters.mine && !userId)
    return { rooms: [], page: 1, pageCount: 0, total: 0 }
  const params = new URLSearchParams({
    page: String(page), limit: String(limit), search: filters.search,
    sort: filters.sort, mine: String(filters.mine),
  })
  const result = await api.request<RoomPage>(`/api/rooms?${params}`)
  if (result.filtersApplied === true) return result

  // Older game servers silently ignore filters. Read every unfiltered page
  // before filtering locally, so matches outside the visible page are included.
  const first = await api.request<RoomPage>('/api/rooms?page=1&limit=50')
  const remaining = await Promise.all(Array.from(
    { length: Math.max(0, first.pageCount - 1) },
    (_, index) => api.request<RoomPage>(`/api/rooms?page=${index + 2}&limit=50`),
  ))
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
  const search = normalize(filters.search.trim())
  const rooms = [first, ...remaining].flatMap((data) => data.rooms).filter((room) =>
    (!search || normalize(room.name).includes(search)) &&
    (!filters.mine || room.creatorId === userId),
  )
  rooms.sort((a, b) => {
    if (filters.sort === 'name') return a.name.localeCompare(b.name, 'pt-BR')
    if (filters.sort === 'belts-desc')
      return (b.beltCount ?? 0) - (a.beltCount ?? 0)
    if (filters.sort === 'score-desc')
      return (b.deliveries ?? 0) - (a.deliveries ?? 0)
    return 0
  })
  const pageCount = Math.ceil(rooms.length / limit)
  const currentPage = Math.min(Math.max(1, page), Math.max(1, pageCount))
  return {
    rooms: rooms.slice((currentPage - 1) * limit, currentPage * limit),
    total: rooms.length, page: currentPage, pageCount,
  }
}
