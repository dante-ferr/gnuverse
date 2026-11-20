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
  /** Clears completed so far; crafts use `ceil(base × ratio^wave)`. */
  escalationWave: number
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

/** Tier-1 bases (and legacy circle) keep flat lifetime quotas. */
export function isBasicDemandShape(rules: PipelineRules, shape: PacketShape): boolean {
  if (shape === 'circle') return true
  const el = rules.elements.elements.find((item) => item.id === shape)
  return Boolean(el && el.tier === 1)
}

export function progressReceived(
  rules: PipelineRules,
  progress: DemandProgress,
  shape: PacketShape,
): number {
  if (progress.sandbox || isBasicDemandShape(rules, shape)) {
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
 * Per-shape quota. Tier-1 bases stay at chapter base.
 * Crafts use ceil(base × escalation_ratio^wave) (wave 0 → base).
 */
export function requiredForShape(
  rules: PipelineRules,
  shape: PacketShape,
  escalationWave = 0,
  sandbox = false,
): number {
  const el = rules.elements.elements.find((item) => item.id === shape)
  if (!el) return rules.elements.defaultDemandRequired
  if (sandbox) return el.demand_required
  const chapterRow = rules.elements.chapters.find((row) => row.id === el.demand_chapter)
  const mult = chapterRow?.required_multiplier ?? 1
  const base = el.demand_required * mult
  if (isBasicDemandShape(rules, shape) || escalationWave <= 0) return base
  const ratio = rules.elements.escalationRatio
  return Math.max(1, Math.ceil(base * ratio ** escalationWave))
}

export function coreDemands(rules: PipelineRules, progress: DemandProgress): CoreDemandRecord[] {
  return activeDemandShapes(progress.chapter, rules, progress.sandbox === true).map((shape) => ({
    shape,
    received: progressReceived(rules, progress, shape),
    required: requiredForShape(rules, shape, progress.escalationWave, progress.sandbox === true),
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
    progress.escalationWave,
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
  deliveryByShape: Partial<Record<PacketShape, number>>
  waveDeliveryByShape: Partial<Record<PacketShape, number>>
  sandbox: boolean
}): DemandProgress {
  return {
    chapter: match.chapter,
    escalationWave: match.escalationWave,
    lifetimeByShape: match.deliveryByShape,
    waveByShape: match.waveDeliveryByShape,
    sandbox: match.sandbox,
  }
}
