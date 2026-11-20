import { cycleCombinerFacing } from '../combiner-place-options.ts'
import { resolveLogisticFacing } from '../logistic-place-facing.ts'
import { proposedSplitterPlacementBlocked, splitterProbeSlots } from '../placement-building-slots.ts'
import { getPlacementFrame } from '../placement-rules.ts'
import type { PipelineFrame } from '../model/frame.ts'
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

function previewSplitterAt(
  cell: { x: number; y: number },
  placementValid = true,
  frame?: PipelineFrame | null,
): StructurePreviewMachine {
  const facing = resolveLogisticFacing(cell, frame ?? getPlacementFrame())
  return {
    machineId: 'splitter',
    x: cell.x,
    y: cell.y,
    facing,
    width: 1,
    height: 1,
    placementValid,
  }
}

function splitterPlacementValid(
  cell: { x: number; y: number },
  frame: PipelineFrame | null | undefined,
): boolean {
  if (!frame) return true
  const facing = resolveLogisticFacing(cell, frame)
  const slots = splitterProbeSlots(cell.x, cell.y, facing)
  const footprints = [{ origin: { x: cell.x, y: cell.y }, width: 1, height: 1 }]
  return !proposedSplitterPlacementBlocked(frame, slots, footprints)
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
      if (!center) return null
      const frame = getPlacementFrame()
      const valid = splitterPlacementValid(center, frame)
      return previewSplitterAt(center, valid, frame)
    },
    isEmpty() {
      return !center
    },
    finish() {
      if (!center) return null
      const frame = getPlacementFrame()
      const ghost = previewSplitterAt(center, true, frame)
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

function splitterHoverGhost(
  cell: { x: number; y: number },
  frame?: PipelineFrame,
): StructureHoverGhost {
  const valid = splitterPlacementValid(cell, frame)
  return { machine: previewSplitterAt(cell, valid, frame) }
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