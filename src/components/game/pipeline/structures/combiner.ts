import { CombinerMachine, type CombinerMachineId } from '../../../../../game-server/pipeline/machines/combiner-machine.ts'
import {
  cycleCombinerFacing,
  getCombinerPlaceOptions,
} from '../combiner-place-options.ts'
import type { Direction } from '../model/frame.ts'
import { originFromCenter } from '../place-geometry.ts'
import {
  combinerProbeSlots,
  proposedBuildingPlacementBlocked,
} from '../placement-building-slots.ts'
import { getPlacementFrame } from '../placement-rules.ts'
import type { PipelineFrame } from '../model/frame.ts'
import { registerStructure } from './registry.ts'
import type {
  StructureDefinition,
  StructureHoverGhost,
  StructurePlacementSession,
  StructurePreviewMachine,
} from './types.ts'

type CombinerPayload = {
  machineId: CombinerMachineId
  x: number
  y: number
  facing: Direction
}

function isCombinerPayload(payload: unknown): payload is CombinerPayload {
  if (!payload || typeof payload !== 'object') return false
  const record = payload as CombinerPayload
  return (
    (record.machineId === 'combiner_2' || record.machineId === 'combiner_3') &&
    typeof record.x === 'number' &&
    typeof record.y === 'number'
  )
}

function previewMachineAt(
  machineId: CombinerMachineId,
  center: { x: number; y: number },
  placementValid = true,
): StructurePreviewMachine {
  const { facing } = getCombinerPlaceOptions()
  const { width, height } = CombinerMachine.sizeFor(machineId, facing)
  const origin = originFromCenter(center, width, height)
  return {
    machineId,
    x: origin.x,
    y: origin.y,
    facing,
    width,
    height,
    placementValid,
  }
}

function combinerPlacementValid(
  machineId: CombinerMachineId,
  center: { x: number; y: number },
  frame: PipelineFrame | null | undefined,
): boolean {
  if (!frame) return true
  const { facing } = getCombinerPlaceOptions()
  const { width, height } = CombinerMachine.sizeFor(machineId, facing)
  const origin = originFromCenter(center, width, height)
  const slots = combinerProbeSlots(machineId, origin.x, origin.y, facing)
  const footprints = [{ origin, width, height }]
  return !proposedBuildingPlacementBlocked(frame, slots, footprints)
}

function createCombinerSession(machineId: CombinerMachineId): StructurePlacementSession {
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
      const valid = combinerPlacementValid(machineId, center, frame)
      return previewMachineAt(machineId, center, valid)
    },
    isEmpty() {
      return !center
    },
    finish() {
      if (!center) return null
      const ghost = previewMachineAt(machineId, center)
      return {
        structureId: machineId,
        payload: {
          machineId,
          x: ghost.x,
          y: ghost.y,
          facing: ghost.facing,
        } satisfies CombinerPayload,
      }
    },
  }
}

function combinerHoverGhost(
  machineId: CombinerMachineId,
  cell: { x: number; y: number },
  frame?: PipelineFrame,
): StructureHoverGhost {
  const valid = combinerPlacementValid(machineId, cell, frame)
  return { machine: previewMachineAt(machineId, cell, valid) }
}

function registerCombiner(
  machineId: CombinerMachineId,
  label: string,
  iconSrc: string,
) {
  const definition: StructureDefinition = {
    id: machineId,
    label,
    iconSrc,
    signInMessage: 'Entre para colocar combinadores.',
    createSession: () => createCombinerSession(machineId),
    hoverGhost: (cell, frame) => combinerHoverGhost(machineId, cell, frame),
    rotate: () => {
      cycleCombinerFacing()
    },
    async commit(ctx, payload) {
      if (!isCombinerPayload(payload)) return
      await ctx.request(`/api/towers/${ctx.roomId}/place-machine`, {
        machineId: payload.machineId,
        x: payload.x,
        y: payload.y,
        facing: payload.facing,
      })
    },
  }
  registerStructure(definition)
}

registerCombiner('combiner_2', 'Combinador', '/pipeline/combiner-2-decor.svg')
registerCombiner('combiner_3', 'Tri-combinador', '/pipeline/combiner-3-decor.svg')