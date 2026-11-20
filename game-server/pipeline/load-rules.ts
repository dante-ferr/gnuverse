import { catalogToJson, loadElementCatalog } from './elements/load-catalog.mjs'
import type { ElementCatalogJson } from './elements/index.ts'
import type { PipelineRules } from './rules.ts'
import { layoutMatchFromSeed } from './world/chunks/match-layout.ts'

const defaults = {
  tick_ms: 250,
  grid_width: 24,
  grid_height: 24,
  color_background: '#0e171d',
  color_grid: '#1f3038',
  grid_visible_min_zoom: 1,
  camera_zoom_min: 0.08,
  camera_zoom_max: 3,
  camera_enter_view_cells: 14,
  lod_detail_min_zoom: 0.55,
  lod_structure_min_zoom: 0.22,
  color_belt: '#667b83',
  color_belt_chevron: '#3e5056',
  color_packet: '#52d6c9',
  color_core: '#ffffff',
  color_source: '#52d6c9',
  color_splitter: '#c9a87c',
  color_trashcan: '#8b6540',
  color_tunnel: '#6d8490',
  tunnel_max_gap: 8,
  color_accent: '#52d6c9',
  color_decor: '#143a38',
  decor_darken_percent: 35,
  outline_width_px: 3,
  color_outline: '#0a1014',
  color_surface: '#152229',
  color_muted: '#6a7b83',
  color_highlight: '#86e7dd',
  color_warning: '#ff8b7d',
  color_success: '#5ecf9a',
  color_ink: '#2a3c44',
  decor_stroke_width: 28,
  resource_glyph_size_px: 28,
  resource_glyph_world_min_zoom: 1.25,
  resource_glyph_orbit_px: 4,
  resource_glyph_orbit_ms: 4000,
  resource_glyph_outline_outer: '#ffffff',
  resource_glyph_outline_inner: '#0a1014',
  resource_glyph_outline_outer_width_px: 3,
  resource_glyph_outline_inner_width_px: 3,
  resource_glyph_outline_spread: 1.35,
  core_gear_outer_ms: 12000,
  core_gear_inner_ms: 7000,
  core_gear_active_ms: 3500,
  belt_chevron_stroke_px: 4,
  belt_chevron_flow_ms: 900,
  belt_speed_fast: 3,
  color_fast_belt: '#667b83',
  color_fast_belt_chevron: '#e85d4f',
  belt_fast_chevron_flow_ms: 300,
  belt_fast_chevron_arm_percent: 22,
  belt_fast_side_inset_percent: 10,
  color_fast_tunnel: '#667b83',
  machine_clearance_min: 1,
  core_clearance_extra: 2,
  chunk_size: 24,
  map_chunk_extent: 64,
  chunk_cost_base: 5,
  chunk_cost_step: 2,
  passive_cap: 120,
  wallet_cap: 1_000_000_000,
  coins_per_minute: 12,
  belt_cost: 1,
  fast_belt_cost: 4,
  splitter_cost: 10,
  trashcan_cost: 8,
  combiner_cost: 15,
  tunnel_cost: 6,
  fast_tunnel_cost: 18,
  satellite_core_count: 2,
  satellite_core_ring_min: 3,
  satellite_core_ring_max: 4,
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
  resource_glyph_orbit_px: [0, 48],
  resource_glyph_orbit_ms: [500, 20_000],
  resource_glyph_outline_outer_width_px: [0, 16],
  resource_glyph_outline_inner_width_px: [0, 16],
  core_gear_outer_ms: [1000, 60_000],
  core_gear_inner_ms: [1000, 60_000],
  core_gear_active_ms: [0, 60_000],
  belt_chevron_stroke_px: [2, 16],
  belt_chevron_flow_ms: [200, 5000],
  belt_speed_fast: [2, 8],
  belt_fast_chevron_flow_ms: [50, 5000],
  belt_fast_chevron_arm_percent: [8, 40],
  belt_fast_side_inset_percent: [2, 30],
  tunnel_max_gap: [0, 32],
  machine_clearance_min: [1, 8],
  core_clearance_extra: [0, 8],
  chunk_size: [8, 64],
  map_chunk_extent: [3, 128],
  chunk_cost_base: [0, 1_000_000],
  chunk_cost_step: [0, 1_000_000],
  passive_cap: [1, 1_000_000_000_000],
  wallet_cap: [1, 1_000_000_000_000],
  coins_per_minute: [1, 60],
  belt_cost: [0, 1_000_000],
  fast_belt_cost: [0, 1_000_000],
  splitter_cost: [0, 1_000_000],
  trashcan_cost: [0, 1_000_000],
  combiner_cost: [0, 1_000_000],
  tunnel_cost: [0, 1_000_000],
  fast_tunnel_cost: [0, 1_000_000],
  satellite_core_count: [0, 8],
  satellite_core_ring_min: [1, 32],
  satellite_core_ring_max: [1, 32],
  slot_input_depth_percent: [5, 45],
  slot_output_depth_percent: [5, 45],
  slot_bracket_thick_percent: [5, 35],
  slot_flow_mark_depth_percent: [4, 20],
  camera_enter_view_cells: [4, 64],
} as const

const floats = {
  grid_visible_min_zoom: [0.1, 10],
  camera_zoom_min: [0.02, 2],
  camera_zoom_max: [0.5, 10],
  lod_detail_min_zoom: [0, 10],
  lod_structure_min_zoom: [0, 10],
  resource_glyph_world_min_zoom: [0.05, 10],
  resource_glyph_outline_spread: [0.5, 4],
} as const

/** Positive safe integers with no max (presentation knobs tuned freely in TOML). */
const unboundedPositiveIntegers = new Set<keyof typeof defaults>(['resource_glyph_size_px'])

const mappings = {
  tick_ms: 'tickMs',
  grid_width: 'gridWidth',
  grid_height: 'gridHeight',
  color_background: 'colorBackground',
  color_grid: 'colorGrid',
  grid_visible_min_zoom: 'gridVisibleMinZoom',
  camera_zoom_min: 'cameraZoomMin',
  camera_zoom_max: 'cameraZoomMax',
  camera_enter_view_cells: 'cameraEnterViewCells',
  lod_detail_min_zoom: 'lodDetailMinZoom',
  lod_structure_min_zoom: 'lodStructureMinZoom',
  color_belt: 'colorBelt',
  color_belt_chevron: 'colorBeltChevron',
  color_packet: 'colorPacket',
  color_core: 'colorCore',
  color_source: 'colorSource',
  color_splitter: 'colorSplitter',
  color_trashcan: 'colorTrashcan',
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
  resource_glyph_world_min_zoom: 'resourceGlyphWorldMinZoom',
  resource_glyph_orbit_px: 'resourceGlyphOrbitPx',
  resource_glyph_orbit_ms: 'resourceGlyphOrbitMs',
  resource_glyph_outline_outer: 'resourceGlyphOutlineOuter',
  resource_glyph_outline_inner: 'resourceGlyphOutlineInner',
  resource_glyph_outline_outer_width_px: 'resourceGlyphOutlineOuterWidthPx',
  resource_glyph_outline_inner_width_px: 'resourceGlyphOutlineInnerWidthPx',
  resource_glyph_outline_spread: 'resourceGlyphOutlineSpread',
  core_gear_outer_ms: 'coreGearOuterMs',
  core_gear_inner_ms: 'coreGearInnerMs',
  core_gear_active_ms: 'coreGearActiveMs',
  belt_chevron_stroke_px: 'beltChevronStrokePx',
  belt_chevron_flow_ms: 'beltChevronFlowMs',
  belt_speed_fast: 'beltSpeedFast',
  color_fast_belt: 'colorFastBelt',
  color_fast_belt_chevron: 'colorFastBeltChevron',
  belt_fast_chevron_flow_ms: 'beltFastChevronFlowMs',
  belt_fast_chevron_arm_percent: 'beltFastChevronArmPercent',
  belt_fast_side_inset_percent: 'beltFastSideInsetPercent',
  color_fast_tunnel: 'colorFastTunnel',
  machine_clearance_min: 'machineClearanceMin',
  core_clearance_extra: 'coreClearanceExtra',
  chunk_size: 'chunkSize',
  map_chunk_extent: 'mapChunkExtent',
  chunk_cost_base: 'chunkCostBase',
  chunk_cost_step: 'chunkCostStep',
  passive_cap: 'passiveCap',
  wallet_cap: 'walletCap',
  coins_per_minute: 'coinsPerMinute',
  belt_cost: 'beltCost',
  fast_belt_cost: 'fastBeltCost',
  splitter_cost: 'splitterCost',
  trashcan_cost: 'trashcanCost',
  combiner_cost: 'combinerCost',
  tunnel_cost: 'tunnelCost',
  fast_tunnel_cost: 'fastTunnelCost',
  satellite_core_count: 'satelliteCoreCount',
  satellite_core_ring_min: 'satelliteCoreRingMin',
  satellite_core_ring_max: 'satelliteCoreRingMax',
  slot_input_depth_percent: 'slotInputDepthPercent',
  slot_output_depth_percent: 'slotOutputDepthPercent',
  slot_bracket_thick_percent: 'slotBracketThickPercent',
  slot_flow_mark_depth_percent: 'slotFlowMarkDepthPercent',
} as const

/** Reads pipeline knobs from `pipeline.toml` and loads `elements.toml` into `rules.elements`. */
export function pipelineRulesFrom(section: unknown): PipelineRules {
  const values =
    section === undefined
      ? {}
      : section && typeof section === 'object' && !Array.isArray(section)
        ? (section as Record<string, unknown>)
        : null
  if (!values) throw new Error('pipeline must be a table')

  for (const key of Object.keys(values)) {
    if (!(key in defaults)) throw new Error(`Unknown game config: pipeline.${key}`)
  }
  const result: Record<string, number | string> = {}
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    const value = values[key] ?? defaults[key]
    const range = integers[key as keyof typeof integers]
    const floatRange = floats[key as keyof typeof floats]
    if (floatRange) {
      const [min, max] = floatRange
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        throw new Error(`${key} must be a number between ${min} and ${max}`)
    } else if (range) {
      const [min, max] = range
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
        throw new Error(`${key} must be an integer between ${min} and ${max}`)
    } else if (unboundedPositiveIntegers.has(key)) {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
        throw new Error(`${key} must be a positive integer`)
    } else if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
      throw new Error(`${key} must be a hex color #RRGGBB`)
    }
    result[mappings[key]] = value
  }

  let elements: ElementCatalogJson
  try {
    elements = catalogToJson(loadElementCatalog()) as ElementCatalogJson
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid element catalog: ${message}`)
  }

  const rules = { ...(result as Omit<PipelineRules, 'elements'>), elements } as PipelineRules
  if (rules.cameraZoomMin >= rules.cameraZoomMax) {
    throw new Error('camera_zoom_min must be less than camera_zoom_max')
  }
  if (rules.lodStructureMinZoom > rules.lodDetailMinZoom) {
    throw new Error('lod_structure_min_zoom must be <= lod_detail_min_zoom')
  }
  if (rules.satelliteCoreRingMin > rules.satelliteCoreRingMax) {
    throw new Error('satellite_core_ring_min must be <= satellite_core_ring_max')
  }
  if (rules.passiveCap > rules.walletCap) {
    throw new Error('passive_cap must not exceed wallet_cap')
  }
  if (rules.elements.starterSourceIds.length < 1) {
    throw new Error('elements.toml: starter_source_ids must list at least one base')
  }
  try {
    layoutMatchFromSeed(rules, 'config-check')
  } catch {
    throw new Error(
      'Pipeline map is too small for the core, starter sources, and required clearance',
    )
  }
  return rules
}
