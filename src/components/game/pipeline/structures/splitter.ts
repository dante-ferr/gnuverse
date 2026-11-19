import { cycleCombinerFacing, getCombinerPlaceOptions } from '../combiner-place-options.ts'
import type { Direction } from '../model/frame.ts'
import { registerStructure } from './registry.ts'
import type {
  StructureDefinition,
  StructureHoverGhost,
  StructurePlacementSession,
  StructurePreviewMachine,
} from './types.ts'

type SplitterPayload = {
  machineId: 'splitter'
  x: number
  y: number
  facing: Direction
}

function isSplitterPayload(payload: unknown): payload is SplitterPayload {
  if (!payload || typeof payload !== 'object') return false
  const record = payload as SplitterPayload
  return (
    record.machineId === 'splitter' &&
    typeof record.x === 'number' &&
    typeof record.y === 'number' &&
    typeof record.facing === 'string'
  )
}

function previewSplitterAt(cell: { x: number; y: number }): StructurePreviewMachine {
  const { facing } = getCombinerPlaceOptions()
  return {
    machineId: 'splitter',
    x: cell.x,
    y: cell.y,
    facing,
    width: 1,
    height: 1,
  }
}

function createSplitterSession(): StructurePlacementSession {
  let center: { x: number; y: number } | null = null
  return {
    push(cell) {
      center = cell
      return true
    },
    previewBelts() {
      return []
    },
    previewMachine() {
      return center ? previewSplitterAt(center) : null
    },
    isEmpty() {
      return !center
    },
    finish() {
      if (!center) return null
      const ghost = previewSplitterAt(center)
      return {
        structureId: 'splitter',
        payload: {
          machineId: 'splitter',
          x: ghost.x,
          y: ghost.y,
          facing: ghost.facing,
        } satisfies SplitterPayload,
      }
    },
  }
}

function splitterHoverGhost(cell: { x: number; y: number }): StructureHoverGhost {
  return { machine: previewSplitterAt(cell) }
}

const splitterStructure: StructureDefinition = {
  id: 'splitter',
  label: 'Divisor',
  iconSrc: '/pipeline/structure-splitter.svg',
  signInMessage: 'Entre para colocar divisores.',
  createSession: createSplitterSession,
  hoverGhost: splitterHoverGhost,
  rotate: () => {
    cycleCombinerFacing()
  },
  async commit(ctx, payload) {
    if (!isSplitterPayload(payload)) return
    await ctx.request(`/api/towers/${ctx.roomId}/place-machine`, {
      machineId: 'splitter',
      x: payload.x,
      y: payload.y,
      facing: payload.facing,
    })
  },
}

registerStructure(splitterStructure)

export { splitterStructure }