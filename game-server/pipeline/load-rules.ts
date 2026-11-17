import type { PipelineRules } from './rules.ts'
import { layoutInitialMachines } from './world/map-layout.ts'

const defaults = {
  tick_ms: 250,
  grid_width: 24,
  grid_height: 24,
  tile_cap: 25,
  source_period_ticks: 4,
  color_background: '#0e171d',
  color_grid: '#23343c',
  color_belt: '#9eb0b7',
  color_packet: '#52d6c9',
  color_core: '#ffffff',
  color_source: '#52d6c9',
  color_accent: '#52d6c9',
  decor_stroke_width: 28,
  resource_glyph_size_px: 28,
  resource_glyph_orbit_px: 10,
  resource_glyph_orbit_ms: 3200,
  machine_clearance_min: 1,
  core_clearance_extra: 2,
} as const

const integers = {
  tick_ms: [50, 5_000],
  grid_width: [24, 64],
  grid_height: [24, 64],
  tile_cap: [1, 500],
  source_period_ticks: [1, 120],
  decor_stroke_width: [12, 64],
  resource_glyph_size_px: [12, 64],
  resource_glyph_orbit_px: [0, 48],
  resource_glyph_orbit_ms: [500, 20_000],
  machine_clearance_min: [1, 8],
  core_clearance_extra: [0, 8],
} as const

const mappings = {
  tick_ms: 'tickMs',
  grid_width: 'gridWidth',
  grid_height: 'gridHeight',
  tile_cap: 'tileCap',
  source_period_ticks: 'sourcePeriodTicks',
  color_background: 'colorBackground',
  color_grid: 'colorGrid',
  color_belt: 'colorBelt',
  color_packet: 'colorPacket',
  color_core: 'colorCore',
  color_source: 'colorSource',
  color_accent: 'colorAccent',
  decor_stroke_width: 'decorStrokeWidth',
  resource_glyph_size_px: 'resourceGlyphSizePx',
  resource_glyph_orbit_px: 'resourceGlyphOrbitPx',
  resource_glyph_orbit_ms: 'resourceGlyphOrbitMs',
  machine_clearance_min: 'machineClearanceMin',
  core_clearance_extra: 'coreClearanceExtra',
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
  try {
    layoutInitialMachines(rules, 'config-check')
  } catch {
    throw new Error(
      'O mapa do pipeline é pequeno demais para o núcleo, a fonte e a folga de segurança',
    )
  }
  return rules
}
