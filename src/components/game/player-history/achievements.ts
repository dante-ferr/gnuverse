import type { GameEvent } from '../model/types'

const ACHIEVEMENT_TYPES = new Set(['place', 'chunk-buy', 'machine-place'])

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
  tunnel: 'Túnel',
}

/** Portuguese label for one achievement event. */
export function formatAchievementLabel(event: GameEvent): string {
  const detail = detailRecord(event.detail)
  if (event.type === 'place') {
    const structure = detail?.structure
    if (structure === 'belt' || structure == null) return 'Colocou esteiras'
    return `Colocou ${String(structure)}`
  }
  if (event.type === 'machine-place') {
    const id = detail?.structure ?? detail?.machine
    if (typeof id === 'string' && id) {
      const label = MACHINE_PLACE_LABELS[id]
      return label ? `Colocou ${label}` : `Colocou a máquina ${id}`
    }
    return 'Colocou uma máquina'
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
