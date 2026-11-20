import { TrashcanMachine } from '../../../../../game-server/pipeline/machines/trashcan-machine.ts'
import {
  cycleCombinerFacing,
  getCombinerPlaceOptions,
} from '../combiner-place-options.ts'
import type { Direction } from '../model/frame.ts'
import { originFromCenter } from '../place-geometry.ts'
import {
  proposedBuildingPlacementBlocked,
  trashcanProbeSlots,
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

type TrashcanPayload = {
  machineId: 'trashcan'
  x: number
  y: number
  facing: Direction
}

function isTrashcanPayload(payload: unknown): payload is TrashcanPayload {
  if (!payload || typeof payload !== 'object') return false
  const record = payload as TrashcanPayload
  return (
    record.machineId === 'trashcan' &&
    typeof record.x === 'number' &&
    typeof record.y === 'number'
  )
}

const FOOTPRINT = {
  width: TrashcanMachine.width,
  height: TrashcanMachine.height,
}

function previewMachineAt(
  center: { x: number; y: number },
  placementValid = true,
): StructurePreviewMachine {
  const { facing } = getCombinerPlaceOptions()
  const origin = originFromCenter(center, FOOTPRINT.width, FOOTPRINT.height)
  return {
    machineId: 'trashcan',
    x: origin.x,
    y: origin.y,
    facing,
    width: FOOTPRINT.width,
    height: FOOTPRINT.height,
    placementValid,
  }
}

function trashcanPlacementValid(
  center: { x: number; y: number },
  frame: PipelineFrame | null | undefined,
): boolean {
  if (!frame) return true
  const { facing } = getCombinerPlaceOptions()
  const origin = originFromCenter(center, FOOTPRINT.width, FOOTPRINT.height)
  const slots = trashcanProbeSlots(origin.x, origin.y, facing)
  const footprints = [{ origin, ...FOOTPRINT }]
  return !proposedBuildingPlacementBlocked(frame, slots, footprints)
}

function createTrashcanSession(): StructurePlacementSession {
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
      const valid = trashcanPlacementValid(center, frame)
      return previewMachineAt(center, valid)
    },
    isEmpty() {
      return !center
    },
    finish() {
      if (!center) return null
      const ghost = previewMachineAt(center)
      return {
        structureId: 'trashcan',
        payload: {
          machineId: 'trashcan',
          x: ghost.x,
          y: ghost.y,
          facing: ghost.facing,
        } satisfies TrashcanPayload,
      }
    },
  }
}

function trashcanHoverGhost(
  cell: { x: number; y: number },
  frame?: PipelineFrame,
): StructureHoverGhost {
  const valid = trashcanPlacementValid(cell, frame)
  return { machine: previewMachineAt(cell, valid) }
}

const trashcanStructure: StructureDefinition = {
  id: 'trashcan',
  label: 'Lixeira',
  iconSrc: '/pipeline/structure-trashcan.svg',
  signInMessage: 'Entre para colocar lixeiras.',
  createSession: createTrashcanSession,
  hoverGhost: trashcanHoverGhost,
  rotate: () => {
    cycleCombinerFacing()
  },
  async commit(ctx, payload) {
    if (!isTrashcanPayload(payload)) return
    await ctx.request(`/api/rooms/${ctx.roomId}/place-machine`, {
      machineId: payload.machineId,
      x: payload.x,
      y: payload.y,
      facing: payload.facing,
    })
  },
}

registerStructure(trashcanStructure)