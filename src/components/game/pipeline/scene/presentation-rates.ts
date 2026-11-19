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

export function combinerCraftProgress(
  craftRemaining: number,
  recipeRatePerMinute: number,
  tickMs: number,
): number {
  const total = ticksForRatePerMinute(recipeRatePerMinute, tickMs)
  const done = total - craftRemaining
  if (total <= 0) return 0
  return Math.min(1, Math.max(0, done / total))
}