import type { PacketShape } from '../packets/packet.ts'
import type { PipelineRules } from '../rules.ts'

export type CoreDemandRecord = {
  shape: PacketShape
  received: number
  required: number
}

/** Shapes the central core counts toward the current version milestone. */
export function activeDemandShapes(version: PipelineFrameVersion): PacketShape[] {
  switch (version) {
    case '0.1':
      return ['circle']
    default:
      return ['circle']
  }
}

export type PipelineFrameVersion = string

function requiredForShape(rules: PipelineRules, shape: PacketShape): number {
  switch (shape) {
    case 'circle':
      return rules.coreDemandCircle
    default:
      return rules.coreDemandCircle
  }
}

export function coreDemands(
  rules: PipelineRules,
  version: PipelineFrameVersion,
  receivedByShape: Partial<Record<PacketShape, number>>,
): CoreDemandRecord[] {
  return activeDemandShapes(version).map((shape) => ({
    shape,
    received: receivedByShape[shape] ?? 0,
    required: requiredForShape(rules, shape),
  }))
}

/** How many more of this shape the core will still accept this version. */
export function remainingDemand(
  rules: PipelineRules,
  version: PipelineFrameVersion,
  shape: PacketShape,
  receivedByShape: Partial<Record<PacketShape, number>>,
): number {
  if (!activeDemandShapes(version).includes(shape)) return 0
  return Math.max(0, requiredForShape(rules, shape) - (receivedByShape[shape] ?? 0))
}

/** Whether the central core still counts deliveries for this shape toward the current milestone. */
export function coreAcceptsShape(
  rules: PipelineRules,
  version: PipelineFrameVersion,
  shape: PacketShape,
  receivedByShape: Partial<Record<PacketShape, number>>,
): boolean {
  return remainingDemand(rules, version, shape, receivedByShape) > 0
}