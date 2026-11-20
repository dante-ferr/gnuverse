import type { ElementRecord } from '../../elements/index.ts'
import type { PipelineRules } from '../../rules.ts'
import type { PacketShape } from '../../packets/packet.ts'

type Memo = Map<string, number>

function elementById(rules: PipelineRules, shape: string): ElementRecord | undefined {
  return rules.elements.elements.find((el) => el.id === shape)
}

function inputIdsForShape(rules: PipelineRules, shape: string): string[] {
  const el = elementById(rules, shape)
  if (!el) return []
  if (el.coproduct_of) {
    const primary = elementById(rules, el.coproduct_of)
    return primary?.inputs ?? []
  }
  return el.inputs
}

function dualOutputShare(rules: PipelineRules, shape: string): boolean {
  const el = elementById(rules, shape)
  if (!el) return false
  if (el.coproduct_of) return true
  return el.outputs.length > 1
}

/** Recursive material mass before effort tuning (tier-1 leaves and legacy circle = 1). */
export function materialUnits(
  rules: PipelineRules,
  shape: PacketShape,
  memo: Memo = new Map(),
  stack: Set<string> = new Set(),
): number {
  if (shape === 'circle') return 1
  if (memo.has(shape)) return memo.get(shape)!

  const el = elementById(rules, shape)
  if (!el) return 1

  if (stack.has(shape)) return 0
  stack.add(shape)

  const inputs = inputIdsForShape(rules, shape)
  let units: number
  if (inputs.length === 0) {
    units = 1
  } else {
    units = inputs.reduce((sum, id) => sum + materialUnits(rules, id, memo, stack), 0)
    if (dualOutputShare(rules, shape)) units /= 2
  }

  stack.delete(shape)
  memo.set(shape, units)
  return units
}

/** Delivery score points for one core intake of `shape`. */
export function deliveryScore(rules: PipelineRules, shape: PacketShape): number {
  const factor = rules.elements.scoreEffortFactor
  return materialUnits(rules, shape) * factor
}