import type { PacketShape } from '../../packets/packet.ts'
import type { PipelineRules } from '../../rules.ts'

export type CoreDemandRecord = {
  shape: PacketShape
  received: number
  required: number
}

export type PipelineFrameVersion = string

/** Shapes the central core counts toward the current version milestone. */
export function activeDemandShapes(
  version: PipelineFrameVersion,
  rules: PipelineRules,
  sandbox = false,
): PacketShape[] {
  if (sandbox) return rules.elements.elements.map((el) => el.id)
  switch (version) {
    case '0.1':
      return ['circle']
    default:
      return ['circle']
  }
}

function requiredForShape(rules: PipelineRules, shape: PacketShape, sandbox = false): number {
  if (sandbox) {
    const el = rules.elements.elements.find((item) => item.id === shape)
    return el?.demand_required ?? rules.elements.defaultDemandRequired
  }
  switch (shape) {
    case 'circle':
      return rules.elements.defaultDemandRequired
    default:
      return rules.elements.defaultDemandRequired
  }
}

export function coreDemands(
  rules: PipelineRules,
  version: PipelineFrameVersion,
  receivedByShape: Partial<Record<PacketShape, number>>,
  sandbox = false,
): CoreDemandRecord[] {
  return activeDemandShapes(version, rules, sandbox).map((shape) => ({
    shape,
    received: receivedByShape[shape] ?? 0,
    required: requiredForShape(rules, shape, sandbox),
  }))
}

/** How many more of this shape the core will still accept this version. */
export function remainingDemand(
  rules: PipelineRules,
  version: PipelineFrameVersion,
  shape: PacketShape,
  receivedByShape: Partial<Record<PacketShape, number>>,
  sandbox = false,
): number {
  if (!activeDemandShapes(version, rules, sandbox).includes(shape)) return 0
  return Math.max(0, requiredForShape(rules, shape, sandbox) - (receivedByShape[shape] ?? 0))
}

/** Whether the central core still counts deliveries for this shape toward the current milestone. */
export function coreAcceptsShape(
  rules: PipelineRules,
  version: PipelineFrameVersion,
  shape: PacketShape,
  receivedByShape: Partial<Record<PacketShape, number>>,
  sandbox = false,
): boolean {
  return remainingDemand(rules, version, shape, receivedByShape, sandbox) > 0
}