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

/** Half the list price, rounded down. A 1-coin belt refunds 0. */
export function halfRefund(listPrice: number): number {
  if (!Number.isInteger(listPrice) || listPrice <= 0) return 0
  return Math.floor(listPrice / 2)
}
