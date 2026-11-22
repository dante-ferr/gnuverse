import type { PipelineRules } from '../../model/frame.ts'

/** Catalog `fill` for an element id, or null when missing / legacy circle. */
export function elementFill(rules: PipelineRules, elementId: string): string | null {
  if (elementId === 'circle') return null
  return rules.elements.elements.find((item) => item.id === elementId)?.fill ?? null
}
