import { cycleBeltPlaceDirection, getBeltPlaceDirection } from '../belt-place-options.ts'
import { BeltStroke } from '../scene/belt-stroke.ts'
import { registerStructure } from './registry.ts'
import type {
  StructureDefinition,
  StructureHoverGhost,
  StructurePlacementSession,
  StructurePreviewBelt,
} from './types.ts'

type BeltPayload = { cells: BeltStroke['cells'] }

function isBeltPayload(payload: unknown): payload is BeltPayload {
  if (!payload || typeof payload !== 'object') return false
  return Array.isArray((payload as BeltPayload).cells)
}

function createBeltSession(): StructurePlacementSession {
  const stroke = new BeltStroke()
  return {
    push(cell) {
      return stroke.push(cell)
    },
    previewBelts(): StructurePreviewBelt[] {
      return stroke.cells.map((cell, index) => ({
        id: `preview-${index}`,
        x: cell.x,
        y: cell.y,
        direction: cell.direction,
        authorId: '',
        authorNickname: '',
        placedAt: index,
      }))
    },
    isEmpty() {
      return stroke.cells.length === 0
    },
    finish() {
      if (stroke.cells.length === 0) return null
      return { structureId: 'belt', payload: { cells: stroke.cells } satisfies BeltPayload }
    },
  }
}

function beltHoverGhost(cell: { x: number; y: number }): StructureHoverGhost {
  return {
    belts: [
      {
        id: 'hover-belt',
        x: cell.x,
        y: cell.y,
        direction: getBeltPlaceDirection(),
        authorId: '',
        authorNickname: '',
        placedAt: 0,
      },
    ],
  }
}

const beltStructure: StructureDefinition = {
  id: 'belt',
  label: 'Esteira',
  iconSrc: '/pipeline/structure-belt.svg',
  signInMessage: 'Entre para colocar esteiras.',
  createSession: createBeltSession,
  hoverGhost: beltHoverGhost,
  rotate: () => {
    cycleBeltPlaceDirection()
  },
  async commit(ctx, payload) {
    if (!isBeltPayload(payload) || payload.cells.length === 0) return
    await ctx.request(`/api/towers/${ctx.roomId}/place`, { cells: payload.cells })
  },
}

registerStructure(beltStructure)

export { beltStructure }
