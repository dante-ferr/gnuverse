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
    proposalDurationMs: configured.proposalDurationMs,
    quorum: configured.quorum,
    approval: configured.approval,
    maxCost: configured.maxCost,
    minContributions: configured.minContributions,
    maxBlocks: configured.maxBlocks,
    maxTowers: configured.maxTowers,
    tokenLifetimeMs: configured.sessionDurationMs,
    banDurationMs: configured.banDurationMs,
    voteChanges: configured.voteChanges,
    prototype: configured.prototype,
    infiniteCoins:
      process.env.NODE_ENV !== 'production' &&
      process.env.GAME_INFINITE_COINS === 'true',
    bdflVeto: configured.bdflVeto,
    windEveryBlocks: configured.windEveryBlocks,
    windMinBlocks: configured.windMinBlocks,
    windStrength: configured.windStrength,
    ...overrides,
  })
  for (const key of [
    'windEveryBlocks',
    'windMinBlocks',
    'cap',
    'initialBalance',
    'intervalMs',
    'cooldownMs',
    'proposalDurationMs',
    'maxCost',
    'minContributions',
    'maxBlocks',
    'maxTowers',
    'tokenLifetimeMs',
    'banDurationMs',
  ] as const) {
    if (
      !Number.isSafeInteger(rules[key]) ||
      rules[key] <
        ([
          'windEveryBlocks',
          'windMinBlocks',
          'intervalMs',
          'proposalDurationMs',
          'tokenLifetimeMs',
          'maxTowers',
          'maxBlocks',
          'banDurationMs',
        ].includes(key)
          ? 1
          : 0)
    )
      throw new Error(`Invalid rule: ${key}`)
  }
  if (
    rules.initialBalance > rules.cap ||
    rules.maxBlocks > 100 ||
    !(rules.quorum > 0 && rules.quorum <= 1) ||
    !(rules.approval >= 0.5 && rules.approval < 1)
  )
    throw new Error('Invalid economy or voting rules')
  if (
    !Number.isFinite(rules.windStrength) ||
    rules.windStrength < 0 ||
    rules.windStrength > 1
  )
    throw new Error('Invalid wind strength')
  if (rules.bdflVeto) throw new Error('Veto do BDFL não é suportado.')
  return rules
}
