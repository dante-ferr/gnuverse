import { cycleBeltPlaceDirection, getBeltPlaceDirection } from '../belt-place-options.ts'
import { getPlacementRules } from '../placement-rules.ts'
import {
  beltHoverPreview,
  commitBeltPayload,
  createBeltStrokeSession,
  isBeltPayload,
} from './belt-placement-shared.ts'
import { registerStructure } from './registry.ts'
import type { StructureDefinition, StructureHoverGhost } from './types.ts'

function fastOptions() {
  const fast = getPlacementRules()?.beltSpeedFast
  return {
    structureId: 'fast_belt' as const,
    // Preview-only until rules arrive (`> 1` paints gold); commit reads beltSpeedFast.
    speed: fast ?? 2,
    tunnelMachineId: 'fast_tunnel' as const,
    previewSpeed: fast ?? 2,
  }
}

function fastHoverGhost(cell: { x: number; y: number }): StructureHoverGhost {
  const fast = getPlacementRules()?.beltSpeedFast ?? 2
  return {
    belts: [beltHoverPreview(cell, getBeltPlaceDirection(), fast)],
  }
}

const fastBeltStructure: StructureDefinition = {
  id: 'fast_belt',
  label: 'Esteira rápida',
  iconSrc: '/pipeline/structure-fast-belt.svg',
  signInMessage: 'Entre para colocar esteiras rápidas.',
  createSession: () => createBeltStrokeSession(fastOptions()),
  hoverGhost: fastHoverGhost,
  rotate: () => {
    cycleBeltPlaceDirection()
  },
  async commit(ctx, payload) {
    if (!isBeltPayload(payload)) return
    await commitBeltPayload(ctx, payload, fastOptions())
  },
}

registerStructure(fastBeltStructure)

export { fastBeltStructure }