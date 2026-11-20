import type { PacketShape } from '../../packets/packet.ts'
import type { PipelineRules } from '../../rules.ts'

export type CoreDemandRecord = {
  shape: PacketShape
  received: number
  required: number
}

export type PipelineFrameVersion = string

/** Progress counters for chapter demands and craft-wave escalation. */
export type DemandProgress = {
  chapter: number
  /** Room clears completed (sidebar Onda / Pontuação). */
  escalationWave: number
  /** Per-shape craft wave; shapes not yet cleared stay at 0 (base quota). */
  escalationWaveByShape: Partial<Record<PacketShape, number>>
  lifetimeByShape: Partial<Record<PacketShape, number>>
  waveByShape: Partial<Record<PacketShape, number>>
  sandbox?: boolean
}

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

export function progressReceived(
  rules: PipelineRules,
  progress: DemandProgress,
  shape: PacketShape,
): number {
  if (progress.sandbox) {
    return progress.lifetimeByShape[shape] ?? 0
  }
  return progress.waveByShape[shape] ?? 0
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

/**
 * Per-shape quota. shapeWave 0 → chapter base; thereafter ceil(base × escalation_ratio^shapeWave).
 */
export function requiredForShape(
  rules: PipelineRules,
  shape: PacketShape,
  shapeWave = 0,
  sandbox = false,
): number {
  const el = rules.elements.elements.find((item) => item.id === shape)
  if (!el) return rules.elements.defaultDemandRequired
  if (sandbox) return el.demand_required
  const chapterRow = rules.elements.chapters.find((row) => row.id === el.demand_chapter)
  const mult = chapterRow?.required_multiplier ?? 1
  const base = el.demand_required * mult
  if (shapeWave <= 0) return base
  const ratio = rules.elements.escalationRatio
  return Math.max(1, Math.ceil(base * ratio ** shapeWave))
}

export function coreDemands(rules: PipelineRules, progress: DemandProgress): CoreDemandRecord[] {
  return activeDemandShapes(progress.chapter, rules, progress.sandbox === true).map((shape) => ({
    shape,
    received: progressReceived(rules, progress, shape),
    required: requiredForShape(
      rules,
      shape,
      progress.escalationWaveByShape[shape] ?? 0,
      progress.sandbox === true,
    ),
  }))
}

/** How many more of this shape the cores will still accept this chapter / wave. */
export function remainingDemand(
  rules: PipelineRules,
  progress: DemandProgress,
  shape: PacketShape,
): number {
  if (!activeDemandShapes(progress.chapter, rules, progress.sandbox === true).includes(shape)) {
    return 0
  }
  const required = requiredForShape(
    rules,
    shape,
    progress.escalationWaveByShape[shape] ?? 0,
    progress.sandbox === true,
  )
  return Math.max(0, required - progressReceived(rules, progress, shape))
}

export function coreAcceptsShape(
  rules: PipelineRules,
  progress: DemandProgress,
  shape: PacketShape,
): boolean {
  return remainingDemand(rules, progress, shape) > 0
}

export function matchDemandProgress(match: {
  chapter: number
  escalationWave: number
  escalationWaveByShape: Partial<Record<PacketShape, number>>
  deliveryByShape: Partial<Record<PacketShape, number>>
  waveDeliveryByShape: Partial<Record<PacketShape, number>>
  sandbox: boolean
}): DemandProgress {
  return {
    chapter: match.chapter,
    escalationWave: match.escalationWave,
    escalationWaveByShape: match.escalationWaveByShape,
    lifetimeByShape: match.deliveryByShape,
    waveByShape: match.waveDeliveryByShape,
    sandbox: match.sandbox,
  }
}