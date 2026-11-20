import type { PacketShape } from '../../packets/packet.ts'
import type { PipelineRules } from '../../rules.ts'

export type CoreDemandRecord = {
  shape: PacketShape
  received: number
  required: number
}

export type PipelineFrameVersion = string

export function chapterToVersion(chapter: number): string {
  return `0.${chapter}`
}

/** Legacy frames stored progression only in `version`. */
export function chapterFromVersion(version: PipelineFrameVersion): number {
  const match = /^(\d+)\.(\d+)$/.exec(version.trim())
  if (!match) return 1
  const minor = Number(match[2])
  return Number.isFinite(minor) && minor >= 1 ? minor : 1
}

/** Shapes the cores count toward the active chapter milestone. */
export function activeDemandShapes(
  chapter: number,
  rules: PipelineRules,
  sandbox = false,
): PacketShape[] {
  if (sandbox) return rules.elements.elements.map((el) => el.id)
  const retain = rules.elements.retainPriorDemands
  return rules.elements.elements
    .filter((el) => (retain ? el.demand_chapter <= chapter : el.demand_chapter === chapter))
    .map((el) => el.id)
}

function requiredForShape(rules: PipelineRules, shape: PacketShape, sandbox = false): number {
  const el = rules.elements.elements.find((item) => item.id === shape)
  if (!el) return rules.elements.defaultDemandRequired
  if (sandbox) return el.demand_required
  const chapterRow = rules.elements.chapters.find((row) => row.id === el.demand_chapter)
  const mult = chapterRow?.required_multiplier ?? 1
  return el.demand_required * mult
}

export function coreDemands(
  rules: PipelineRules,
  chapter: number,
  receivedByShape: Partial<Record<PacketShape, number>>,
  sandbox = false,
): CoreDemandRecord[] {
  return activeDemandShapes(chapter, rules, sandbox).map((shape) => ({
    shape,
    received: receivedByShape[shape] ?? 0,
    required: requiredForShape(rules, shape, sandbox),
  }))
}

/** How many more of this shape the cores will still accept this chapter. */
export function remainingDemand(
  rules: PipelineRules,
  chapter: number,
  shape: PacketShape,
  receivedByShape: Partial<Record<PacketShape, number>>,
  sandbox = false,
): number {
  if (!activeDemandShapes(chapter, rules, sandbox).includes(shape)) return 0
  return Math.max(0, requiredForShape(rules, shape, sandbox) - (receivedByShape[shape] ?? 0))
}

/** Whether the cores still count deliveries for this shape toward the current milestone. */
export function coreAcceptsShape(
  rules: PipelineRules,
  chapter: number,
  shape: PacketShape,
  receivedByShape: Partial<Record<PacketShape, number>>,
  sandbox = false,
): boolean {
  return remainingDemand(rules, chapter, shape, receivedByShape, sandbox) > 0
}