import {
  periodMsForRatePerMinute,
  resolveRecipeRatePerMinute as resolveRecipeRateFromCatalog,
  resolveSourceRatePerMinute as resolveSourceRateFromCatalog,
  ticksForRatePerMinute,
} from '../../../../../game-server/pipeline/elements/rate.ts'
import type { PipelineRules } from '../model/frame.ts'

const HOLD_TAIL_MS = 1000

export function ratePerMinuteFromPeriodTicks(ticks: number, tickMs: number): number {
  const periodMs = ticks * tickMs
  if (periodMs <= 0) return 60
  return 60_000 / periodMs
}

export function resolveSourceRatePerMinute(rules: PipelineRules, elementId: string): number {
  const el = rules.elements.elements.find((item) => item.id === elementId)
  if (!el) return rules.elements.defaultSourceRatePerMinute
  return resolveSourceRateFromCatalog(rules.elements, el)
}

export function resolveRecipeRatePerMinute(rules: PipelineRules, recipeId: string): number {
  const el = rules.elements.elements.find((item) => item.id === recipeId)
  if (!el) return rules.elements.defaultRatePerMinute
  return resolveRecipeRateFromCatalog(rules.elements, el)
}

export function sourcePeriodMsForGlyph(rules: PipelineRules, elementId: string): number {
  return periodMsForRatePerMinute(resolveSourceRatePerMinute(rules, elementId))
}

/** Orbit while exporting or within one source period plus tail after the last export. */
export function sourceGlyphShouldOrbit(
  exporting: boolean,
  lastExportAtMs: number | undefined,
  timeMs: number,
  periodMs: number,
): boolean {
  if (exporting) return true
  if (lastExportAtMs === undefined) return false
  return timeMs - lastExportAtMs < periodMs + HOLD_TAIL_MS
}

/** Spin gears while a core is within `activeMs` of its last client-noted intake. */
export function coreGearsShouldSpin(
  lastActiveAtMs: number | undefined,
  timeMs: number,
  activeMs: number,
): boolean {
  if (lastActiveAtMs === undefined) return false
  if (activeMs <= 0) return false
  return timeMs - lastActiveAtMs < activeMs
}

/**
 * Craft wheel fill in [0, 1].
 * `craftRemaining` starts at `total - 1` and counts down each sim tick; `tickPhase`
 * (0..1 within the current tick, from packet-motion sync) interpolates so the arc
 * advances smoothly instead of jumping per tick.
 */
export function combinerCraftProgress(
  craftRemaining: number,
  recipeRatePerMinute: number,
  tickMs: number,
  tickPhase = 0,
): number {
  const total = ticksForRatePerMinute(recipeRatePerMinute, tickMs)
  if (total <= 0) return 0
  if (craftRemaining <= 0) return 1
  const phase = Math.min(1, Math.max(0, tickPhase))
  // Start frame has remaining = total - 1 → progress 0; last visible tick reaches 1.
  if (total === 1) return phase
  const completed = total - craftRemaining - 1 + phase
  return Math.min(1, Math.max(0, completed / (total - 1)))
}