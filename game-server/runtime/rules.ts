import { loadGameConfig } from '../config/load-game-config.ts'
import type { PipelineRules } from '../pipeline/rules.ts'
import type { Rules } from '../domain/types.ts'

export function createRules(
  overrides: Partial<Omit<Rules, 'pipeline'>> & { pipeline?: Partial<PipelineRules> } = {},
): Rules {
  const loaded = loadGameConfig()
  const configured = loaded.rules
  const { pipeline: pipelineOverride, ...rest } = overrides
  const pipeline = { ...loaded.pipeline, ...pipelineOverride }
  // Mutable so `watchGameConfig` can hot-reload TOML into the live rules object.
  const rules: Rules = {
    cap: pipeline.walletCap,
    initialBalance: configured.initialBalance,
    intervalMs: Math.max(1, Math.round(60_000 / pipeline.coinsPerMinute)),
    cooldownMs: configured.actionCooldownMs,
    minContributions: configured.minContributions,
    maxBelts: configured.maxBelts,
    maxRooms: configured.maxRooms,
    maxRoomsPerCreator: configured.maxRoomsPerCreator,
    tokenLifetimeMs: configured.sessionDurationMs,
    banDurationMs: configured.banDurationMs,
    chatMessageMaxLength: configured.chatMessageMaxLength,
    chatHistoryLimit: configured.chatHistoryLimit,
    chatCooldownMs: configured.chatCooldownMs,
    prototype: configured.prototype,
    infiniteCoins:
      process.env.NODE_ENV !== 'production' &&
      process.env.GAME_INFINITE_COINS === 'true',
    bdflVeto: configured.bdflVeto,
    pipeline,
    ...rest,
  }
  for (const key of [
    'cap',
    'initialBalance',
    'intervalMs',
    'cooldownMs',
    'minContributions',
    'maxBelts',
    'maxRooms',
    'maxRoomsPerCreator',
    'tokenLifetimeMs',
    'banDurationMs',
    'chatMessageMaxLength',
    'chatHistoryLimit',
    'chatCooldownMs',
  ] as const) {
    if (
      !Number.isSafeInteger(rules[key]) ||
      rules[key] <
        ([
          'intervalMs',
          'tokenLifetimeMs',
          'maxRooms',
          'maxRoomsPerCreator',
          'maxBelts',
          'banDurationMs',
          'chatMessageMaxLength',
          'chatHistoryLimit',
        ].includes(key)
          ? 1
          : 0)
    )
      throw new Error(`Invalid rule: ${key}`)
  }
  if (
    rules.initialBalance > rules.pipeline.passiveCap ||
    rules.pipeline.passiveCap > rules.pipeline.walletCap ||
    rules.maxBelts > 500
  )
    throw new Error('Invalid economy rules')
  if (rules.bdflVeto) throw new Error('Veto do BDFL não é suportado.')
  return rules
}