import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { parse } from 'smol-toml'
import { pipelineRulesFrom } from '../pipeline/load-rules.ts'
import type { PipelineRules } from '../pipeline/rules.ts'

export type GameRules = {
  balanceCap: number
  initialBalance: number
  coinIntervalMs: number
  actionCooldownMs: number
  defaultCost: number
  maxCost: number
  minContributions: number
  banDurationMs: number
  maxSegments: number
  maxTowers: number
  sessionDurationMs: number
  prototype: boolean
  bdflVeto: boolean
}

export type TreeRules = {
  worldWidth: number
  worldHeight: number
  exitX: number
  exitY: number
  exitWidth: number
  exitHeight: number
  rootX: number
  rootClearanceAboveTerrain: number
  terrainSamples: number
  terrainAmplitude: number
  terrainMaxSlope: number
  terrainBaseY: number
  lMax: number
  minGroundClearance: number
  minUpwardDelta: number
  minSegmentLength: number
  maxSecondaryRoots: number
  worldMargin: number
  energyCapacity: number
  energyInitial: number
  energyPerLeaf: number
  energyDrainPerSegment: number
  fireflyRadius: number
  fireflyPathPoints: number
  fireflyMaxPhases: number
  fireflyXMargin: number
  fireflyYLow: number
  fireflyYStartMin: number
  fireflyYStartMax: number
  fireflyStepYMin: number
  fireflyStepYMax: number
  fireflyStepX: number
  actionWindowMs: number
  physicsPhaseMs: number
  winEnergyPhases: number
  costGrow: number
  costLeaf: number
  costFortify: number
  costPrune: number
  costRoot: number
  physicsFps: number
  physicsSubsteps: number
  gravityScale: number
  segmentBodyWidth: number
  stressThresholdNormal: number
  stressThresholdFortified: number
  colorBackground: string
  colorForeground: string
  colorFireflyGlow: string
  colorExitStroke: string
  cameraPanSpeed: number
  clickDragThresholdPx: number
  segmentHitPadding: number
  nodeHitRadius: number
  growAnchorTolerance: number
}

export type LoadedGameConfig = {
  rules: GameRules
  tree: TreeRules
  pipeline: PipelineRules
}

const economyDefaults = {
  balance_cap: 5,
  initial_balance: 5,
  coin_interval_ms: 6_000,
  action_cooldown_ms: 0,
  default_cost: 1,
  max_cost: 20,
  min_contributions: 3,
  ban_duration_ms: 600_000,
  max_segments: 200,
  max_towers: 200,
  session_duration_ms: 604_800_000,
  prototype: true,
  bdfl_veto: false,
} satisfies Record<string, number | boolean>

const treeDefaults = {
  world_width: 1600,
  world_height: 1200,
  exit_x: 720,
  exit_y: 0,
  exit_width: 160,
  exit_height: 80,
  root_x: 800,
  root_clearance_above_terrain: 60,
  terrain_samples: 160,
  terrain_amplitude: 48,
  terrain_max_slope: 0.12,
  terrain_base_y: 1160,
  l_max: 90,
  min_ground_clearance: 40,
  min_upward_delta: 20,
  min_segment_length: 20,
  max_secondary_roots: 2,
  world_margin: 40,
  energy_capacity: 100,
  energy_initial: 40,
  energy_per_leaf: 8,
  energy_drain_per_segment: 2,
  firefly_radius: 120,
  firefly_path_points: 4,
  firefly_max_phases: 6,
  firefly_x_margin: 120,
  firefly_y_low: 200,
  firefly_y_start_min: 900,
  firefly_y_start_max: 1050,
  firefly_step_y_min: 180,
  firefly_step_y_max: 260,
  firefly_step_x: 80,
  action_window_ms: 10_000,
  physics_phase_ms: 4_000,
  win_energy_phases: 2,
  cost_grow: 1,
  cost_leaf: 1,
  cost_fortify: 2,
  cost_prune: 1,
  cost_root: 2,
  physics_fps: 60,
  physics_substeps: 4,
  gravity_scale: 2,
  segment_body_width: 8,
  stress_threshold_normal: 32,
  stress_threshold_fortified: 55,
  color_background: '#1a2420',
  color_foreground: '#e8ebe4',
  color_firefly_glow: '#fff6a8',
  color_exit_stroke: '#6a7568',
  camera_pan_speed: 10,
  click_drag_threshold_px: 6,
  segment_hit_padding: 20,
  node_hit_radius: 16,
  grow_anchor_tolerance: 12,
} satisfies Record<string, number | string>

const economyMappings = {
  balance_cap: 'balanceCap',
  initial_balance: 'initialBalance',
  coin_interval_ms: 'coinIntervalMs',
  action_cooldown_ms: 'actionCooldownMs',
  default_cost: 'defaultCost',
  max_cost: 'maxCost',
  min_contributions: 'minContributions',
  ban_duration_ms: 'banDurationMs',
  max_segments: 'maxSegments',
  max_towers: 'maxTowers',
  session_duration_ms: 'sessionDurationMs',
  prototype: 'prototype',
  bdfl_veto: 'bdflVeto',
} as const

const treeMappings = {
  world_width: 'worldWidth',
  world_height: 'worldHeight',
  exit_x: 'exitX',
  exit_y: 'exitY',
  exit_width: 'exitWidth',
  exit_height: 'exitHeight',
  root_x: 'rootX',
  root_clearance_above_terrain: 'rootClearanceAboveTerrain',
  terrain_samples: 'terrainSamples',
  terrain_amplitude: 'terrainAmplitude',
  terrain_max_slope: 'terrainMaxSlope',
  terrain_base_y: 'terrainBaseY',
  l_max: 'lMax',
  min_ground_clearance: 'minGroundClearance',
  min_upward_delta: 'minUpwardDelta',
  min_segment_length: 'minSegmentLength',
  max_secondary_roots: 'maxSecondaryRoots',
  world_margin: 'worldMargin',
  energy_capacity: 'energyCapacity',
  energy_initial: 'energyInitial',
  energy_per_leaf: 'energyPerLeaf',
  energy_drain_per_segment: 'energyDrainPerSegment',
  firefly_radius: 'fireflyRadius',
  firefly_path_points: 'fireflyPathPoints',
  firefly_max_phases: 'fireflyMaxPhases',
  firefly_x_margin: 'fireflyXMargin',
  firefly_y_low: 'fireflyYLow',
  firefly_y_start_min: 'fireflyYStartMin',
  firefly_y_start_max: 'fireflyYStartMax',
  firefly_step_y_min: 'fireflyStepYMin',
  firefly_step_y_max: 'fireflyStepYMax',
  firefly_step_x: 'fireflyStepX',
  action_window_ms: 'actionWindowMs',
  physics_phase_ms: 'physicsPhaseMs',
  win_energy_phases: 'winEnergyPhases',
  cost_grow: 'costGrow',
  cost_leaf: 'costLeaf',
  cost_fortify: 'costFortify',
  cost_prune: 'costPrune',
  cost_root: 'costRoot',
  physics_fps: 'physicsFps',
  physics_substeps: 'physicsSubsteps',
  gravity_scale: 'gravityScale',
  segment_body_width: 'segmentBodyWidth',
  stress_threshold_normal: 'stressThresholdNormal',
  stress_threshold_fortified: 'stressThresholdFortified',
  color_background: 'colorBackground',
  color_foreground: 'colorForeground',
  color_firefly_glow: 'colorFireflyGlow',
  color_exit_stroke: 'colorExitStroke',
  camera_pan_speed: 'cameraPanSpeed',
  click_drag_threshold_px: 'clickDragThresholdPx',
  segment_hit_padding: 'segmentHitPadding',
  node_hit_radius: 'nodeHitRadius',
  grow_anchor_tolerance: 'growAnchorTolerance',
} as const

const economyIntegerRules: Record<string, { min: number; max: number }> = {
  balance_cap: { min: 1, max: 1_000_000 },
  initial_balance: { min: 0, max: 1_000_000 },
  coin_interval_ms: { min: 1_000, max: 31_536_000_000 },
  action_cooldown_ms: { min: 0, max: 86_400_000 },
  default_cost: { min: 0, max: 1_000_000 },
  max_cost: { min: 0, max: 1_000_000 },
  min_contributions: { min: 1, max: 1_000_000 },
  ban_duration_ms: { min: 1_000, max: 31_536_000_000 },
  max_segments: { min: 1, max: 500 },
  max_towers: { min: 1, max: 100_000 },
  session_duration_ms: { min: 60_000, max: 31_536_000_000 },
}

const treeIntegerKeys = new Set([
  'world_width',
  'world_height',
  'exit_x',
  'exit_y',
  'exit_width',
  'exit_height',
  'root_x',
  'root_clearance_above_terrain',
  'terrain_samples',
  'terrain_amplitude',
  'terrain_base_y',
  'l_max',
  'min_ground_clearance',
  'min_upward_delta',
  'min_segment_length',
  'max_secondary_roots',
  'world_margin',
  'energy_capacity',
  'energy_initial',
  'energy_per_leaf',
  'energy_drain_per_segment',
  'firefly_radius',
  'firefly_path_points',
  'firefly_max_phases',
  'firefly_x_margin',
  'firefly_y_low',
  'firefly_y_start_min',
  'firefly_y_start_max',
  'firefly_step_y_min',
  'firefly_step_y_max',
  'firefly_step_x',
  'action_window_ms',
  'physics_phase_ms',
  'win_energy_phases',
  'cost_grow',
  'cost_leaf',
  'cost_fortify',
  'cost_prune',
  'cost_root',
  'physics_fps',
  'physics_substeps',
  'segment_body_width',
  'stress_threshold_normal',
  'stress_threshold_fortified',
  'click_drag_threshold_px',
  'segment_hit_padding',
  'node_hit_radius',
  'grow_anchor_tolerance',
])

const treeFloatKeys = new Set(['terrain_max_slope', 'camera_pan_speed', 'gravity_scale'])
const treeColorKeys = new Set([
  'color_background',
  'color_foreground',
  'color_firefly_glow',
  'color_exit_stroke',
])

const economyKeys = Object.keys(economyDefaults) as (keyof typeof economyDefaults)[]
const treeKeys = Object.keys(treeDefaults) as (keyof typeof treeDefaults)[]
const knownKeys = new Set<string>([...economyKeys, ...treeKeys, 'pipeline'])

let cached: LoadedGameConfig | null = null

function validateEconomy(values: Record<string, unknown>): GameRules {
  const result: Record<string, unknown> = {}
  for (const key of economyKeys) {
    const value = values[key] ?? economyDefaults[key]
    const range = economyIntegerRules[key]
    if (range) {
      if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < range.min ||
        value > range.max
      ) {
        throw new Error(
          `${key} deve ser inteiro entre ${range.min} e ${range.max}`,
        )
      }
    } else if (key === 'prototype' || key === 'bdfl_veto') {
      if (typeof value !== 'boolean')
        throw new Error(`${key} deve ser booleano`)
    }
    result[economyMappings[key as keyof typeof economyMappings]] = value
  }
  const rules = result as GameRules
  if (rules.initialBalance > rules.balanceCap) {
    throw new Error('initial_balance não pode exceder balance_cap')
  }
  if (rules.defaultCost > rules.maxCost) {
    throw new Error('default_cost não pode exceder max_cost')
  }
  if (rules.bdflVeto) {
    throw new Error(
      'bdfl_veto está reservado e não pode ser ativado nesta versão',
    )
  }
  return rules
}

function validateTree(values: Record<string, unknown>): TreeRules {
  const result: Record<string, unknown> = {}
  for (const key of treeKeys) {
    const value = values[key] ?? treeDefaults[key]
    if (treeIntegerKeys.has(key)) {
      if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < 0
      ) {
        throw new Error(`${key} deve ser inteiro não negativo`)
      }
    } else if (treeFloatKeys.has(key)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new Error(`${key} deve ser número positivo`)
      }
    } else if (treeColorKeys.has(key)) {
      if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
        throw new Error(`${key} deve ser cor hex #RRGGBB`)
      }
    }
    result[treeMappings[key as keyof typeof treeMappings]] = value
  }
  const tree = result as TreeRules
  if (tree.terrainAmplitude > tree.worldHeight / 4) {
    throw new Error('terrain_amplitude grande demais para o mundo')
  }
  if (tree.minSegmentLength > tree.lMax) {
    throw new Error('min_segment_length não pode exceder l_max')
  }
  return tree
}

function parseConfig(contents: Record<string, unknown>): LoadedGameConfig {
  for (const key of Object.keys(contents)) {
    if (!knownKeys.has(key))
      throw new Error(`Configuração de jogo desconhecida: ${key}`)
  }
  return {
    rules: validateEconomy(contents),
    tree: validateTree(contents),
    pipeline: pipelineRulesFrom(contents.pipeline),
  }
}

/** Lê e valida as regras. O erro de leitura, sintaxe ou validação aborta a inicialização. */
export function loadGameConfig(configPath?: string): LoadedGameConfig {
  if (!configPath && cached) return cached
  const defaultConfigPath = fileURLToPath(
    new URL('./game.config.toml', import.meta.url),
  )
  const projectRootPath = fileURLToPath(new URL('../../', import.meta.url))
  const selectedPath =
    configPath ?? (process.env.GAME_CONFIG_PATH || defaultConfigPath)
  const absolutePath = path.isAbsolute(selectedPath)
    ? selectedPath
    : path.resolve(projectRootPath, selectedPath)
  const contents = readFileSync(absolutePath, 'utf8')
  const parsed = parse(contents) as Record<string, unknown>
  const config = parseConfig(parsed)
  if (!configPath) cached = config
  return config
}

export function getLoadedTreeRules(): TreeRules {
  return loadGameConfig().tree
}