import { cycleBeltPlaceDirection, getBeltPlaceDirection } from '../belt-place-options.ts'
import {
  beltHoverPreview,
  commitBeltPayload,
  createBeltStrokeSession,
  isBeltPayload,
} from './belt-placement-shared.ts'
import { registerStructure } from './registry.ts'
import type { StructureDefinition, StructureHoverGhost } from './types.ts'

const beltOptions = {
  structureId: 'belt' as const,
  speed: 1,
  tunnelMachineId: 'tunnel' as const,
}

function beltHoverGhost(cell: { x: number; y: number }): StructureHoverGhost {
  return {
    belts: [beltHoverPreview(cell, getBeltPlaceDirection(), 1)],
  }
}

const beltStructure: StructureDefinition = {
  id: 'belt',
  label: 'Esteira',
  iconSrc: '/pipeline/structure-belt.svg',
  signInMessage: 'Entre para colocar esteiras.',
  createSession: () => createBeltStrokeSession(beltOptions),
  hoverGhost: beltHoverGhost,
  rotate: () => {
    cycleBeltPlaceDirection()
  },
  async commit(ctx, payload) {
    if (!isBeltPayload(payload)) return
    await commitBeltPayload(ctx, payload, beltOptions)
  },
}

registerStructure(beltStructure)

export { beltStructure }