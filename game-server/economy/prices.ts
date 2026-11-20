import type { PipelineRules } from '../pipeline/rules.ts'

/** List price of one belt cell at `speed`. Same speed redraws are free at the call site. */
export function beltListPrice(rules: PipelineRules, speed: number): number {
  return speed === rules.beltSpeedFast ? rules.fastBeltCost : rules.beltCost
}

/** List price of one placed machine. Tunnel prices are per pair, not per portal. */
export function machineListPrice(rules: PipelineRules, machineId: string): number {
  switch (machineId) {
    case 'splitter':
      return rules.splitterCost
    case 'trashcan':
      return rules.trashcanCost
    case 'combiner_2':
    case 'combiner_3':
      return rules.combinerCost
    case 'tunnel':
      return rules.tunnelCost
    case 'fast_tunnel':
      return rules.fastTunnelCost
    default:
      return 0
  }
}

/**
 * Coins returned when an owned fast belt/tunnel is downgraded to normal.
 * Applies `refund_percent` to (`fast − normal`).
 */
export function speedDowngradeRefund(
  rules: PipelineRules,
  kind: 'belt' | 'tunnel',
): number {
  const fast = kind === 'belt' ? rules.fastBeltCost : rules.fastTunnelCost
  const normal = kind === 'belt' ? rules.beltCost : rules.tunnelCost
  return structureRefund(rules, fast - normal)
}

/**
 * Own-structure refund from `refund_percent` in `[pipeline]`.
 * Rounded down. A price of 1 with 50% refunds 0.
 */
export function structureRefund(rules: PipelineRules, listPrice: number): number {
  if (!Number.isInteger(listPrice) || listPrice <= 0) return 0
  const percent = rules.refundPercent
  if (!Number.isInteger(percent) || percent <= 0) return 0
  return Math.floor((listPrice * percent) / 100)
}
