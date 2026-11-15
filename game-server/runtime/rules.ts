import { loadGameConfig } from '../config/load-game-config.ts'
import type { Rules } from '../domain/types.ts'

export function createRules(overrides: Partial<Rules> = {}): Readonly<Rules> {
  const configured = loadGameConfig().rules
  const rules: Readonly<Rules> = Object.freeze({
    cap: configured.balanceCap,
    initialBalance: configured.initialBalance,
    intervalMs: configured.coinIntervalMs,
    cooldownMs: configured.actionCooldownMs,
    defaultCost: configured.defaultCost,
    maxCost: configured.maxCost,
    minContributions: configured.minContributions,
    maxSegments: configured.maxSegments,
    maxTowers: configured.maxTowers,
    tokenLifetimeMs: configured.sessionDurationMs,
    banDurationMs: configured.banDurationMs,
    prototype: configured.prototype,
    infiniteCoins:
      process.env.NODE_ENV !== 'production' &&
      process.env.GAME_INFINITE_COINS === 'true',
    bdflVeto: configured.bdflVeto,
    ...overrides,
  })
  for (const key of [
    'cap',
    'initialBalance',
    'intervalMs',
    'cooldownMs',
    'maxCost',
    'minContributions',
    'maxSegments',
    'maxTowers',
    'tokenLifetimeMs',
    'banDurationMs',
  ] as const) {
    if (
      !Number.isSafeInteger(rules[key]) ||
      rules[key] <
        ([
          'intervalMs',
          'tokenLifetimeMs',
          'maxTowers',
          'maxSegments',
          'banDurationMs',
        ].includes(key)
          ? 1
          : 0)
    )
      throw new Error(`Invalid rule: ${key}`)
  }
  if (rules.initialBalance > rules.cap || rules.maxSegments > 500)
    throw new Error('Invalid economy rules')
  if (rules.bdflVeto) throw new Error('Veto do BDFL não é suportado.')
  return rules
}