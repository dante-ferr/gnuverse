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
  maxBelts: number
  maxRooms: number
  sessionDurationMs: number
  chatMessageMaxLength: number
  chatHistoryLimit: number
  chatCooldownMs: number
  prototype: boolean
  bdflVeto: boolean
}

export type LoadedGameConfig = {
  rules: GameRules
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
  max_belts: 200,
  max_rooms: 200,
  session_duration_ms: 604_800_000,
  chat_message_max_length: 280,
  chat_history_limit: 100,
  chat_cooldown_ms: 1000,
  prototype: true,
  bdfl_veto: false,
} satisfies Record<string, number | boolean>

const economyMappings = {
  balance_cap: 'balanceCap',
  initial_balance: 'initialBalance',
  coin_interval_ms: 'coinIntervalMs',
  action_cooldown_ms: 'actionCooldownMs',
  default_cost: 'defaultCost',
  max_cost: 'maxCost',
  min_contributions: 'minContributions',
  ban_duration_ms: 'banDurationMs',
  max_belts: 'maxBelts',
  max_rooms: 'maxRooms',
  session_duration_ms: 'sessionDurationMs',
  chat_message_max_length: 'chatMessageMaxLength',
  chat_history_limit: 'chatHistoryLimit',
  chat_cooldown_ms: 'chatCooldownMs',
  prototype: 'prototype',
  bdfl_veto: 'bdflVeto',
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
  max_belts: { min: 1, max: 500 },
  max_rooms: { min: 1, max: 100_000 },
  session_duration_ms: { min: 60_000, max: 31_536_000_000 },
  chat_message_max_length: { min: 1, max: 2000 },
  chat_history_limit: { min: 10, max: 500 },
  chat_cooldown_ms: { min: 0, max: 60_000 },
}

const economyKeys = Object.keys(economyDefaults) as (keyof typeof economyDefaults)[]
const knownKeys = new Set<string>([...economyKeys, 'pipeline'])

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

function parseConfig(contents: Record<string, unknown>): LoadedGameConfig {
  for (const key of Object.keys(contents)) {
    if (!knownKeys.has(key))
      throw new Error(`Configuração de jogo desconhecida: ${key}`)
  }
  return {
    rules: validateEconomy(contents),
    pipeline: pipelineRulesFrom(contents.pipeline),
  }
}

function readGameConfigFromDisk(absolutePath: string): LoadedGameConfig {
  const contents = readFileSync(absolutePath, 'utf8')
  const parsed = parse(contents) as Record<string, unknown>
  return parseConfig(parsed)
}

/** Resolves `GAME_CONFIG_PATH` or the packaged default to an absolute path. */
export function resolveGameConfigPath(configPath?: string): string {
  const defaultConfigPath = fileURLToPath(
    new URL('./game.config.toml', import.meta.url),
  )
  const projectRootPath = fileURLToPath(new URL('../../', import.meta.url))
  const selectedPath =
    configPath ?? (process.env.GAME_CONFIG_PATH || defaultConfigPath)
  return path.isAbsolute(selectedPath)
    ? selectedPath
    : path.resolve(projectRootPath, selectedPath)
}

export function clearGameConfigCache(): void {
  cached = null
}

/** Re-reads config from disk. Updates the startup cache when the default path is used. */
export function reloadGameConfig(configPath?: string): LoadedGameConfig {
  clearGameConfigCache()
  const absolutePath = resolveGameConfigPath(configPath)
  const config = readGameConfigFromDisk(absolutePath)
  if (absolutePath === resolveGameConfigPath()) cached = config
  return config
}

/** Lê e valida as regras. O erro de leitura, sintaxe ou validação aborta a inicialização. */
export function loadGameConfig(configPath?: string): LoadedGameConfig {
  if (!configPath && cached) return cached
  const absolutePath = resolveGameConfigPath(configPath)
  const config = readGameConfigFromDisk(absolutePath)
  if (!configPath) cached = config
  return config
}