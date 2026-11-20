import type { PipelineFrame, PipelineRules } from './model/frame.ts'

/** Latest pipeline rules for placement validation (set from the room scene). */
let placementRules: PipelineRules | null = null
let placementFrame: PipelineFrame | null = null

export function setPlacementRules(rules: PipelineRules | null) {
  placementRules = rules
}

export function getPlacementRules(): PipelineRules | null {
  return placementRules
}

export function setPlacementFrame(frame: PipelineFrame | null) {
  placementFrame = frame
}

export function getPlacementFrame(): PipelineFrame | null {
  return placementFrame
}