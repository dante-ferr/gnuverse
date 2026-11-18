import type { PipelineRules } from './rules.ts'
import { layoutInitialMachines } from './world/map-layout.ts'

const defaults = {
  tick_ms: 250,
  grid_width: 24,
  grid_height: 24,
  source_period_ticks: 4,
  color_background: '#0e171d',
  color_grid: '#23343c',
  color_belt: '#9eb0b7',
  color_packet: '#52d6c9',
  color_core: '#ffffff',
  color_source: '#52d6c9',
  color_accent: '#52d6c9',
  color_decor: '#1a4542',
  decor_darken_percent: 35,
  outline_width_px: 3,
  color_outline: '#0a1014',
  color_surface: '#17252c',
  color_muted: '#6a7b83',
  color_highlight: '#86e7dd',
  color_warning: '#ff8b7d',
  color_success: '#5ed4b0',
  color_ink: '#293c45',
  decor_stroke_width: 28,
  resource_glyph_size_px: 28,
  resource_glyph_orbit_px: 4,
  resource_glyph_orbit_ms: 4000,
  belt_chevron_stroke_px: 6,
  belt_chevron_flow_ms: 900,
  machine_clearance_min: 1,
  core_clearance_extra: 2,
  core_demand_circle: 20,
  chunk_size: 24,
  map_chunk_extent: 64,
  chunk_cost_base: 5,
  chunk_cost_growth: 2,
  chunk_preview_ring: 1,
  slot_input_depth_percent: 22,
  slot_output_depth_percent: 34,
  slot_bracket_thick_percent: 18,
  slot_flow_mark_depth_percent: 12,
} as const

const integers = {
  tick_ms: [50, 5_000],
  grid_width: [24, 64],
  grid_height: [24, 64],
  source_period_ticks: [1, 120],
  decor_darken_percent: [0, 90],
  outline_width_px: [1, 12],
  decor_stroke_width: [12, 64],
  resource_glyph_size_px: [12, 64],
  resource_glyph_orbit_px: [0, 48],
  resource_glyph_orbit_ms: [500, 20_000],
  belt_chevron_stroke_px: [2, 16],
  belt_chevron_flow_ms: [200, 5000],
  machine_clearance_min: [1, 8],
  core_clearance_extra: [0, 8],
  core_demand_circle: [1, 999_999],
  chunk_size: [8, 64],
  map_chunk_extent: [3, 128],
  chunk_cost_base: [0, 1_000_000],
  chunk_cost_growth: [1, 100],
  chunk_preview_ring: [1, 8],
  slot_input_depth_percent: [5, 45],
  slot_output_depth_percent: [5, 45],
  slot_bracket_thick_percent: [5, 35],
  slot_flow_mark_depth_percent: [4, 20],
} as const

const mappings = {
  tick_ms: 'tickMs',
  grid_width: 'gridWidth',
  grid_height: 'gridHeight',
  source_period_ticks: 'sourcePeriodTicks',
  color_background: 'colorBackground',
  color_grid: 'colorGrid',
  color_belt: 'colorBelt',
  color_packet: 'colorPacket',
  color_core: 'colorCore',
  color_source: 'colorSource',
  color_accent: 'colorAccent',
  color_decor: 'colorDecor',
  decor_darken_percent: 'decorDarkenPercent',
  outline_width_px: 'outlineWidthPx',
  color_outline: 'colorOutline',
  color_surface: 'colorSurface',
  color_muted: 'colorMuted',
  color_highlight: 'colorHighlight',
  color_warning: 'colorWarning',
  color_success: 'colorSuccess',
  color_ink: 'colorInk',
  decor_stroke_width: 'decorStrokeWidth',
  resource_glyph_size_px: 'resourceGlyphSizePx',
  resource_glyph_orbit_px: 'resourceGlyphOrbitPx',
  resource_glyph_orbit_ms: 'resourceGlyphOrbitMs',
  belt_chevron_stroke_px: 'beltChevronStrokePx',
  belt_chevron_flow_ms: 'beltChevronFlowMs',
  machine_clearance_min: 'machineClearanceMin',
  core_clearance_extra: 'coreClearanceExtra',
  core_demand_circle: 'coreDemandCircle',
  chunk_size: 'chunkSize',
  map_chunk_extent: 'mapChunkExtent',
  chunk_cost_base: 'chunkCostBase',
  chunk_cost_growth: 'chunkCostGrowth',
  chunk_preview_ring: 'chunkPreviewRing',
  slot_input_depth_percent: 'slotInputDepthPercent',
  slot_output_depth_percent: 'slotOutputDepthPercent',
  slot_bracket_thick_percent: 'slotBracketThickPercent',
  slot_flow_mark_depth_percent: 'slotFlowMarkDepthPercent',
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
