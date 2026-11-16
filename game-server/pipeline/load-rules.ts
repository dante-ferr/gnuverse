import type { PipelineRules } from './rules.ts'

const defaults = {
  tick_ms: 250,
  grid_width: 24,
  grid_height: 24,
  tile_cap: 25,
  source_period_ticks: 4,
  stability_capacity: 100,
  stability_initial: 80,
  stability_window_ticks: 16,
  stability_required_deliveries: 2,
  stability_drain: 2,
  stability_restore: 3,
  stability_grace_ticks: 80,
  color_background: '#f4f1ea',
  color_grid: '#d9d3c5',
  color_belt: '#2c3330',
  color_packet: '#1f6f5b',
  color_core: '#243028',
  color_source: '#243028',
  color_stability: '#c4552a',
  color_stability_ok: '#2f7d4a',
} as const

const integers = {
  tick_ms: [50, 5_000],
  grid_width: [16, 64],
  grid_height: [16, 64],
  tile_cap: [1, 500],
  source_period_ticks: [1, 120],
  stability_capacity: [1, 10_000],
  stability_initial: [0, 10_000],
  stability_window_ticks: [1, 600],
  stability_required_deliveries: [1, 10_000],
  stability_drain: [1, 10_000],
  stability_restore: [1, 10_000],
  stability_grace_ticks: [0, 10_000],
} as const

const mappings = {
  tick_ms: 'tickMs',
  grid_width: 'gridWidth',
  grid_height: 'gridHeight',
  tile_cap: 'tileCap',
  source_period_ticks: 'sourcePeriodTicks',
  stability_capacity: 'stabilityCapacity',
  stability_initial: 'stabilityInitial',
  stability_window_ticks: 'stabilityWindowTicks',
  stability_required_deliveries: 'stabilityRequiredDeliveries',
  stability_drain: 'stabilityDrain',
  stability_restore: 'stabilityRestore',
  stability_grace_ticks: 'stabilityGraceTicks',
  color_background: 'colorBackground',
  color_grid: 'colorGrid',
  color_belt: 'colorBelt',
  color_packet: 'colorPacket',
  color_core: 'colorCore',
  color_source: 'colorSource',
  color_stability: 'colorStability',
  color_stability_ok: 'colorStabilityOk',
} as const

/** Reads the `[pipeline]` table. Missing keys use the v0.1 defaults. */
export function pipelineRulesFrom(section: unknown): PipelineRules {
  const values =
    section === undefined
      ? {}
      : section && typeof section === 'object' && !Array.isArray(section)
        ? (section as Record<string, unknown>)
        : null
  if (!values) throw new Error('pipeline deve ser uma tabela')
  for (const key of Object.keys(values)) {
    if (!(key in defaults)) throw new Error(`Configuração de jogo desconhecida: pipeline.${key}`)
  }
  const result: Record<string, number | string> = {}
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    const value = values[key] ?? defaults[key]
    const range = integers[key as keyof typeof integers]
    if (range) {
      const [min, max] = range
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
        throw new Error(`${key} deve ser inteiro entre ${min} e ${max}`)
    } else if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
      throw new Error(`${key} deve ser cor hex #RRGGBB`)
    }
    result[mappings[key]] = value
  }
  const rules = result as PipelineRules
  if (rules.stabilityInitial > rules.stabilityCapacity)
    throw new Error('stability_initial não pode exceder stability_capacity')
  if (rules.gridWidth < 16 || rules.gridHeight < 16)
    throw new Error('O mapa do pipeline é pequeno demais para o núcleo')
  return rules
}
