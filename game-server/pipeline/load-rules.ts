import { catalogToJson, loadElementCatalog } from './elements/load-catalog.mjs'
import type { ElementCatalogJson } from './elements/index.ts'
import type { PipelineRules } from './rules.ts'
import { layoutMatchFromSeed } from './world/chunks/match-layout.ts'

const defaults = {
  tick_ms: 250,
  grid_width: 24,
  grid_height: 24,
  color_background: '#0e171d',
  color_grid: '#23343c',
  grid_visible_min_zoom: 1,
  camera_zoom_min: 0.08,
  camera_zoom_max: 3,
  color_belt: '#9eb0b7',
  color_belt_chevron: '#6b7d87',
  color_packet: '#52d6c9',
  color_core: '#ffffff',
  color_source: '#52d6c9',
  color_splitter: '#c4a574',
  color_tunnel: '#7a8f9a',
  tunnel_max_gap: 8,
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
  resource_glyph_outline_outer: '#ffffff',
  resource_glyph_outline_inner: '#0a1014',
  resource_glyph_outline_outer_width_px: 3,
  resource_glyph_outline_inner_width_px: 3,
  resource_glyph_outline_spread: 1.35,
  core_gear_outer_ms: 12000,
  core_gear_inner_ms: 7000,
  belt_chevron_stroke_px: 4,
  belt_chevron_flow_ms: 900,
  machine_clearance_min: 1,
  core_clearance_extra: 2,
  chunk_size: 24,
  map_chunk_extent: 64,
  chunk_cost_base: 5,
  chunk_cost_step: 2,
  slot_input_depth_percent: 22,
  slot_output_depth_percent: 34,
  slot_bracket_thick_percent: 18,
  slot_flow_mark_depth_percent: 12,
} as const

const integers = {
  tick_ms: [50, 5_000],
  grid_width: [24, 64],
  grid_height: [24, 64],
  decor_darken_percent: [0, 90],
  outline_width_px: [1, 12],
  decor_stroke_width: [12, 64],
  resource_glyph_size_px: [12, 64],
  resource_glyph_orbit_px: [0, 48],
  resource_glyph_orbit_ms: [500, 20_000],
  resource_glyph_outline_outer_width_px: [0, 16],
  resource_glyph_outline_inner_width_px: [0, 16],
  core_gear_outer_ms: [1000, 60_000],
  core_gear_inner_ms: [1000, 60_000],
  belt_chevron_stroke_px: [2, 16],
  belt_chevron_flow_ms: [200, 5000],
  tunnel_max_gap: [1, 32],
  machine_clearance_min: [1, 8],
  core_clearance_extra: [0, 8],
  chunk_size: [8, 64],
  map_chunk_extent: [3, 128],
  chunk_cost_base: [0, 1_000_000],
  chunk_cost_step: [0, 1_000_000],
  slot_input_depth_percent: [5, 45],
  slot_output_depth_percent: [5, 45],
  slot_bracket_thick_percent: [5, 35],
  slot_flow_mark_depth_percent: [4, 20],
} as const

const floats = {
  grid_visible_min_zoom: [0.1, 10],
  camera_zoom_min: [0.02, 2],
  camera_zoom_max: [0.5, 10],
  resource_glyph_outline_spread: [0.5, 4],
} as const

const mappings = {
  tick_ms: 'tickMs',
  grid_width: 'gridWidth',
  grid_height: 'gridHeight',
  color_background: 'colorBackground',
  color_grid: 'colorGrid',
  grid_visible_min_zoom: 'gridVisibleMinZoom',
  camera_zoom_min: 'cameraZoomMin',
  camera_zoom_max: 'cameraZoomMax',
  color_belt: 'colorBelt',
  color_belt_chevron: 'colorBeltChevron',
  color_packet: 'colorPacket',
  color_core: 'colorCore',
  color_source: 'colorSource',
  color_splitter: 'colorSplitter',
  color_tunnel: 'colorTunnel',
  tunnel_max_gap: 'tunnelMaxGap',
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
  resource_glyph_outline_outer: 'resourceGlyphOutlineOuter',
  resource_glyph_outline_inner: 'resourceGlyphOutlineInner',
  resource_glyph_outline_outer_width_px: 'resourceGlyphOutlineOuterWidthPx',
  resource_glyph_outline_inner_width_px: 'resourceGlyphOutlineInnerWidthPx',
  resource_glyph_outline_spread: 'resourceGlyphOutlineSpread',
  core_gear_outer_ms: 'coreGearOuterMs',
  core_gear_inner_ms: 'coreGearInnerMs',
  belt_chevron_stroke_px: 'beltChevronStrokePx',
  belt_chevron_flow_ms: 'beltChevronFlowMs',
  machine_clearance_min: 'machineClearanceMin',
  core_clearance_extra: 'coreClearanceExtra',
  chunk_size: 'chunkSize',
  map_chunk_extent: 'mapChunkExtent',
  chunk_cost_base: 'chunkCostBase',
  chunk_cost_step: 'chunkCostStep',
  slot_input_depth_percent: 'slotInputDepthPercent',
  slot_output_depth_percent: 'slotOutputDepthPercent',
  slot_bracket_thick_percent: 'slotBracketThickPercent',
  slot_flow_mark_depth_percent: 'slotFlowMarkDepthPercent',
} as const

/** Reads the `[pipeline]` table and loads `elements.toml` into `rules.elements`. */
export function pipelineRulesFrom(section: unknown): PipelineRules {
  const values =
    section === undefined
      ? {}
      : section && typeof section === 'object' && !Array.isArray(section)
        ? (section as Record<string, unknown>)
        : null
  if (!values) throw new Error('pipeline deve ser uma tabela')

  // Legacy per-element spawn keys lived in game.config; spawn odds now live on each base in elements.toml.
  const ignoredLegacy = new Set([
    'source_spawn_chance_circle_percent',
    'source_spawn_chance_fire_percent',
    'source_spawn_chance_water_percent',
  ])
  for (const key of Object.keys(values)) {
    if (ignoredLegacy.has(key)) continue
    if (!(key in defaults)) throw new Error(`Configuração de jogo desconhecida: pipeline.${key}`)
  }
  const result: Record<string, number | string> = {}
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    const value = values[key] ?? defaults[key]
    const range = integers[key as keyof typeof integers]
    const floatRange = floats[key as keyof typeof floats]
    if (floatRange) {
      const [min, max] = floatRange
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        throw new Error(`${key} deve ser número entre ${min} e ${max}`)
    } else if (range) {
      const [min, max] = range
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
        throw new Error(`${key} deve ser inteiro entre ${min} e ${max}`)
    } else if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
      throw new Error(`${key} deve ser cor hex #RRGGBB`)
    }
    result[mappings[key]] = value
  }

  let elements: ElementCatalogJson
  try {
    elements = catalogToJson(loadElementCatalog()) as ElementCatalogJson
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Catálogo de elementos inválido: ${message}`)
  }

  const rules = { ...(result as Omit<PipelineRules, 'elements'>), elements } as PipelineRules
  if (rules.cameraZoomMin >= rules.cameraZoomMax) {
    throw new Error('camera_zoom_min deve ser menor que camera_zoom_max')
  }
  if (rules.elements.starterSourceIds.length < 1) {
    throw new Error('elements.toml: starter_source_ids deve listar ao menos uma base')
  }
  try {
    layoutMatchFromSeed(rules, 'config-check')
  } catch {
    throw new Error(
      'O mapa do pipeline é pequeno demais para o núcleo, as fontes iniciais e a folga de segurança',
    )
  }
  return rules
}
