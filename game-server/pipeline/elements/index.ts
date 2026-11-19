export {
  catalogToJson,
  defaultElementsConfigDir,
  loadElementCatalog,
} from './load-catalog.mjs'

export type ElementMachineKind = {
  id: string
  name_pt: string
  input_slots: number
  output_slots: number
  coupled_dual_output: boolean
  split_single_across_ports: boolean
  color: string
  decor: string
  default_rate_per_minute: number
}

export type ElementChapter = {
  id: number
  name_pt: string
  summary_pt: string
  max_new_bases: number
  required_multiplier: number
}

export type ElementPreviewConfig = {
  node_width: number
  node_height: number
  column_gap: number
  row_gap: number
  highway_lane: number
}

export type ElementRecord = {
  id: string
  name_pt: string
  tier: number
  family: string
  sort_key: number
  fill: string
  stroke: string
  glyph: string
  glyph_size_px: number
  inputs: string[]
  outputs: string[]
  coproduct_of: string | null
  machine: string | null
  rate_per_minute: number | null
  productivity: number | null
  demand_chapter: number
  demand_required: number
  source_rate_per_minute: number | null
  source_spawn_chance_percent: number | null
}

/** JSON-safe catalog attached to `PipelineRules.elements`. */
export type ElementCatalogJson = {
  maxTier: number
  retainPriorDemands: boolean
  defaultRatePerMinute: number
  defaultSourceRatePerMinute: number
  defaultProductivity: number
  defaultGlyphSizePx: number
  defaultStroke: string
  defaultDemandRequired: number
  starterSourceIds: string[]
  preview: ElementPreviewConfig
  machines: ElementMachineKind[]
  chapters: ElementChapter[]
  elements: ElementRecord[]
}
