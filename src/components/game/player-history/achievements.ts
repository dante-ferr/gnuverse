import type { GameEvent } from '../model/types'

const ACHIEVEMENT_TYPES = new Set(['place', 'chunk-buy', 'chunk-fund', 'machine-place'])

export function isAchievementEvent(event: GameEvent): boolean {
  return ACHIEVEMENT_TYPES.has(event.type)
}

export function playerAchievements(
  events: readonly GameEvent[],
  actorId: string,
): GameEvent[] {
  return events
    .filter((event) => event.actorId === actorId && isAchievementEvent(event))
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
}

function detailRecord(detail: unknown): Record<string, unknown> | null {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null
  return detail as Record<string, unknown>
}

const MACHINE_PLACE_LABELS: Record<string, string> = {
  combiner_2: 'Combinador',
  combiner_3: 'Tri-combinador',
  splitter: 'Divisor',
  trashcan: 'Lixeira',
  tunnel: 'Túnel',
}

/** Portuguese label for one achievement event. */
export function formatAchievementLabel(event: GameEvent): string {
  const detail = detailRecord(event.detail)
  if (event.type === 'place') {
    const structure = detail?.structure
    const cost = typeof detail?.cost === 'number' ? ` · ${detail.cost} moedas` : ''
    if (structure === 'fast_belt') return `Colocou esteiras rápidas${cost}`
    if (structure === 'belt' || structure == null) return `Colocou esteiras${cost}`
    return `Colocou ${String(structure)}${cost}`
  }
  if (event.type === 'machine-place') {
    const id = detail?.structure ?? detail?.machine
    const cost = typeof detail?.cost === 'number' ? ` · ${detail.cost} moedas` : ''
    if (typeof id === 'string' && id) {
      const label = MACHINE_PLACE_LABELS[id] ?? (id === 'fast_tunnel' ? 'Túnel rápido' : undefined)
      return label ? `Colocou ${label}${cost}` : `Colocou a máquina ${id}${cost}`
    }
    return 'Colocou uma máquina'
  }
  if (event.type === 'chunk-fund') {
    const amount = detail?.amount
    const cx = detail?.cx
    const cy = detail?.cy
    const coord = typeof cx === 'number' && typeof cy === 'number' ? ` (${cx}, ${cy})` : ''
    const coins = typeof amount === 'number' ? `${amount} moedas` : 'moedas'
    return `Aportou ${coins} no trecho${coord}`
  }
  if (event.type === 'chunk-buy') {
    const cx = detail?.cx
    const cy = detail?.cy
    const cost = detail?.cost
    const coord =
      typeof cx === 'number' && typeof cy === 'number' ? ` (${cx}, ${cy})` : ''
    const costLabel = typeof cost === 'number' ? ` · ${cost} moedas` : ''
    return `Comprou um chunk${coord}${costLabel}`
  }
  return event.type
}

export function formatAchievementTime(createdAt: number): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(createdAt))
  } catch {
    return new Date(createdAt).toLocaleString('pt-BR')
  }
}
