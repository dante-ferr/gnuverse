import type { GameApi } from './game-api'
import type { Tower } from '../model/types'

export type TowerFilters = {
  search: string
  cost: 'all' | 'free' | 'paid'
  sort: 'oldest' | 'name' | 'cost-asc' | 'cost-desc' | 'blocks-desc'
  mine: boolean
}
export const DEFAULT_TOWER_FILTERS: TowerFilters = {
  search: '', cost: 'all', sort: 'oldest', mine: false,
}

type TowerPage = {
  towers: Tower[]
  page: number
  pageCount: number
  total: number
  filtersApplied?: boolean
}

export async function listTowers(
  api: Pick<GameApi, 'request'>,
  filters: TowerFilters,
  page: number,
  userId?: string,
): Promise<TowerPage> {
  const limit = 12
  if (filters.mine && !userId)
    return { towers: [], page: 1, pageCount: 0, total: 0 }
  const params = new URLSearchParams({
    page: String(page), limit: String(limit), search: filters.search,
    cost: filters.cost, sort: filters.sort, mine: String(filters.mine),
  })
  const result = await api.request<TowerPage>(`/api/towers?${params}`)
  if (result.filtersApplied === true) return result

  // Older game servers silently ignore filters. Read every unfiltered page
  // before filtering locally, so matches outside the visible page are included.
  const first = await api.request<TowerPage>('/api/towers?page=1&limit=50')
  const remaining = await Promise.all(Array.from(
    { length: Math.max(0, first.pageCount - 1) },
    (_, index) => api.request<TowerPage>(`/api/towers?page=${index + 2}&limit=50`),
  ))
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
  const search = normalize(filters.search.trim())
  const towers = [first, ...remaining].flatMap((data) => data.towers).filter((tower) =>
    (!search || normalize(tower.name).includes(search)) &&
    (filters.cost === 'all' || (filters.cost === 'free' ? tower.cost === 0 : tower.cost > 0)) &&
    (!filters.mine || tower.creatorId === userId),
  )
  towers.sort((a, b) => {
    if (filters.sort === 'name') return a.name.localeCompare(b.name, 'pt-BR')
    if (filters.sort === 'cost-asc') return a.cost - b.cost
    if (filters.sort === 'cost-desc') return b.cost - a.cost
    if (filters.sort === 'blocks-desc') return b.blockCount - a.blockCount
    return 0
  })
  const pageCount = Math.ceil(towers.length / limit)
  const currentPage = Math.min(Math.max(1, page), Math.max(1, pageCount))
  return {
    towers: towers.slice((currentPage - 1) * limit, currentPage * limit),
    total: towers.length, page: currentPage, pageCount,
  }
}
