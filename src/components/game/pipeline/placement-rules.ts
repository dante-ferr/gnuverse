import type { PipelineRules } from './model/frame.ts'

/** Latest pipeline rules for placement validation (set from the room scene). */
let placementRules: PipelineRules | null = null

export function setPlacementRules(rules: PipelineRules | null) {
  placementRules = rules
}

export function getPlacementRules(): PipelineRules | null {
  return placementRules
}