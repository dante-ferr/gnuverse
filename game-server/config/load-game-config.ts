import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { parse } from 'smol-toml'

export type GameRules = {
  balanceCap: number
  initialBalance: number
  coinIntervalMs: number
  actionCooldownMs: number
  defaultCost: number
  maxCost: number
  proposalDurationMs: number
  quorum: number
  approval: number
  minContributions: number
  banDurationMs: number
  maxBlocks: number
  maxTowers: number
  sessionDurationMs: number
  voteChanges: boolean
  prototype: boolean
  bdflVeto: boolean
  windEveryBlocks: number
  windMinBlocks: number
  windStrength: number
}

const defaults = {
  balance_cap: 20,
  initial_balance: 20,
  coin_interval_ms: 30_000,
  action_cooldown_ms: 2_000,
  default_cost: 1,
  max_cost: 20,
  proposal_duration_ms: 120_000,
  quorum: 0.5,
  approval: 0.5,
  min_contributions: 3,
  ban_duration_ms: 600_000,
  max_blocks: 100,
  max_towers: 200,
  session_duration_ms: 604_800_000,
  vote_changes: false,
  prototype: true,
  bdfl_veto: false,
  wind_every_blocks: 10,
  wind_min_blocks: 15,
  wind_strength: 0.3,
} satisfies Record<string, number | boolean>

const mappings = {
  balance_cap: 'balanceCap',
  initial_balance: 'initialBalance',
  coin_interval_ms: 'coinIntervalMs',
  action_cooldown_ms: 'actionCooldownMs',
  default_cost: 'defaultCost',
  max_cost: 'maxCost',
  proposal_duration_ms: 'proposalDurationMs',
  quorum: 'quorum',
  approval: 'approval',
  min_contributions: 'minContributions',
  ban_duration_ms: 'banDurationMs',
  max_blocks: 'maxBlocks',
  max_towers: 'maxTowers',
  session_duration_ms: 'sessionDurationMs',
  vote_changes: 'voteChanges',
  prototype: 'prototype',
  bdfl_veto: 'bdflVeto',
  wind_every_blocks: 'windEveryBlocks',
  wind_min_blocks: 'windMinBlocks',
  wind_strength: 'windStrength',
} as const

const integerRules: Record<string, { min: number; max: number }> = {
  wind_every_blocks: { min: 1, max: 1_000_000 },
  wind_min_blocks: { min: 1, max: 1_000_000 },
  balance_cap: { min: 1, max: 1_000_000 },
  initial_balance: { min: 0, max: 1_000_000 },
  coin_interval_ms: { min: 1_000, max: 31_536_000_000 },
  action_cooldown_ms: { min: 0, max: 86_400_000 },
  default_cost: { min: 0, max: 1_000_000 },
  max_cost: { min: 0, max: 1_000_000 },
  proposal_duration_ms: { min: 1_000, max: 31_536_000_000 },
  min_contributions: { min: 1, max: 1_000_000 },
  ban_duration_ms: { min: 1_000, max: 31_536_000_000 },
  max_blocks: { min: 1, max: 100 },
  max_towers: { min: 1, max: 100_000 },
  session_duration_ms: { min: 60_000, max: 31_536_000_000 },
}

const fractionRules: Record<string, { min: number; max: number }> = {
  wind_strength: { min: 0, max: 1 },
  quorum: { min: Number.EPSILON, max: 1 },
  approval: { min: 0.5, max: 1 - Number.EPSILON },
}

const booleanKeys = ['vote_changes', 'prototype', 'bdfl_veto'] as const
const keys = Object.keys(defaults) as (keyof typeof defaults)[]
const knownKeys = new Set<string>(keys)

function validate(values: Record<string, unknown>): GameRules {
  for (const key of Object.keys(values)) {
    if (!knownKeys.has(key))
      throw new Error(`Configuração de jogo desconhecida: ${key}`)
  }

  const result: Record<string, unknown> = {}
  for (const key of keys) {
    const value = values[key] ?? defaults[key]
    const range = integerRules[key]
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
    } else if (fractionRules[key]) {
      const bounds = fractionRules[key]
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < bounds.min ||
        value > bounds.max
      ) {
        throw new Error(
          `${key} deve ser número entre ${bounds.min} e ${bounds.max}`,
        )
      }
    } else if (
      (booleanKeys as readonly string[]).includes(key) &&
      typeof value !== 'boolean'
    ) {
      throw new Error(`${key} deve ser booleano`)
    }
    result[mappings[key as keyof typeof mappings]] = value
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

/** Lê e valida as regras. O erro de leitura, sintaxe ou validação aborta a inicialização. */
export function loadGameConfig(configPath?: string): { rules: GameRules } {
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
  return { rules: validate(parsed) }
}
