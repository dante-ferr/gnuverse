import type { ElementCatalogJson, ElementRecord } from './index.ts'

/** Milliseconds between pieces at a pieces-per-minute rate. */
export function periodMsForRatePerMinute(ratePerMinute: number): number {
  if (!(ratePerMinute > 0) || !Number.isFinite(ratePerMinute)) {
    throw new Error(`rate_per_minute must be a positive number, got ${ratePerMinute}`)
  }
  return 60_000 / ratePerMinute
}

/** Sim ticks between pieces. At 60/min and tick_ms 250 this is 4. */
export function ticksForRatePerMinute(ratePerMinute: number, tickMs: number): number {
  const periodMs = periodMsForRatePerMinute(ratePerMinute)
  return Math.max(1, Math.round(periodMs / tickMs))
}

export function resolveRecipeRatePerMinute(
  catalog: ElementCatalogJson,
  recipe: ElementRecord,
): number {
  if (recipe.rate_per_minute != null) return recipe.rate_per_minute
  const machine = recipe.machine
    ? catalog.machines.find((m) => m.id === recipe.machine)
    : undefined
  return machine?.default_rate_per_minute ?? catalog.defaultRatePerMinute
}

export function resolveSourceRatePerMinute(
  catalog: ElementCatalogJson,
  base: ElementRecord,
): number {
  return base.source_rate_per_minute ?? catalog.defaultSourceRatePerMinute
}

export function craftTicksForRecipe(
  catalog: ElementCatalogJson,
  tickMs: number,
  recipe: ElementRecord,
): number {
  return ticksForRatePerMinute(resolveRecipeRatePerMinute(catalog, recipe), tickMs)
}

export function sourcePeriodTicksForElement(
  catalog: ElementCatalogJson,
  tickMs: number,
  element: ElementRecord,
): number {
  return ticksForRatePerMinute(resolveSourceRatePerMinute(catalog, element), tickMs)
}

export function defaultSourcePeriodTicks(catalog: ElementCatalogJson, tickMs: number): number {
  return ticksForRatePerMinute(catalog.defaultSourceRatePerMinute, tickMs)
}

export function sourcePeriodTicksForRole(
  catalog: ElementCatalogJson,
  tickMs: number,
  role: string | undefined,
): number {
  const el = catalog.elements.find((item) => item.id === role)
  if (el && el.tier === 1 && !el.coproduct_of) {
    return sourcePeriodTicksForElement(catalog, tickMs, el)
  }
  return defaultSourcePeriodTicks(catalog, tickMs)
}