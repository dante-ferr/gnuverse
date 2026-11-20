import { ahead } from '../../../../../game-server/pipeline/geometry/direction.ts'
import {
  TunnelPortalMachine,
  tunnelPairGeometry,
} from '../../../../../game-server/pipeline/machines/tunnel-machine.ts'
import { cycleCombinerFacing } from '../combiner-place-options.ts'
import { resolveLogisticFacing, resolveTunnelFacing } from '../logistic-place-facing.ts'
import { getPlacementFrame, getPlacementRules } from '../placement-rules.ts'
import {
  proposedTunnelPlacementBlocked,
  tunnelProbeSlots,
} from '../placement-building-slots.ts'
import type { Direction } from '../model/frame.ts'
import {
  clearTunnelPlacement,
  markTunnelEntrance,
  tunnelPendingEntrance,
} from './tunnel.ts'
import { registerStructure } from './registry.ts'
import type {
  GridCell,
  StructureDefinition,
  StructureHoverGhost,
  StructurePlacementSession,
  StructurePreviewMachine,
} from './types.ts'

type FastTunnelPayload = {
  machineId: 'fast_tunnel'
  entranceX: number
  entranceY: number
  exitX: number
  exitY: number
  facing: Direction
}

function isFastTunnelPayload(payload: unknown): payload is FastTunnelPayload {
  if (!payload || typeof payload !== 'object') return false
  const record = payload as FastTunnelPayload
  return (
    record.machineId === 'fast_tunnel' &&
    typeof record.entranceX === 'number' &&
    typeof record.entranceY === 'number' &&
    typeof record.exitX === 'number' &&
    typeof record.exitY === 'number'
  )
}

function tunnelMaxGap(): number {
  return getPlacementRules()?.tunnelMaxGap ?? 8
}

function previewPortal(
  cell: { x: number; y: number },
  role: 'entrance' | 'exit',
  facing: Direction,
  placementValid = true,
): StructurePreviewMachine {
  return {
    machineId: 'fast_tunnel',
    x: cell.x,
    y: cell.y,
    facing,
    width: 1,
    height: 1,
    tunnelRole: role,
    placementValid,
  }
}

function exitPlacementValid(
  entrance: { x: number; y: number },
  exit: { x: number; y: number },
  facing: Direction,
): boolean {
  const geom = tunnelPairGeometry(entrance, exit, facing, tunnelMaxGap())
  if (!geom.ok) return false
  const frame = getPlacementFrame()
  if (!frame) return true
  const slots = tunnelProbeSlots(entrance, exit, facing, geom.gap)
  const footprints = [
    { origin: entrance, width: 1, height: 1 },
    { origin: exit, width: 1, height: 1 },
  ]
  return !proposedTunnelPlacementBlocked(frame, slots, footprints)
}

function entrancePlacementValid(
  cell: { x: number; y: number },
  frame: import('../model/frame.ts').PipelineFrame | undefined,
): boolean {
  if (!frame) return true
  const facing = resolveLogisticFacing(cell, frame)
  const slots = new TunnelPortalMachine(
    'probe',
    cell,
    'entrance',
    'probe',
    facing,
    { id: 'preview', nickname: 'preview' },
    0,
  ).slots
  const footprints = [{ origin: cell, width: 1, height: 1 }]
  return !proposedTunnelPlacementBlocked(frame, slots, footprints)
}

function validExitCells(entrance: GridCell, facing: Direction): GridCell[] {
  const maxGap = tunnelMaxGap()
  const cells: GridCell[] = []
  let tip = entrance
  for (let step = 1; step <= maxGap + 1; step++) {
    tip = ahead(tip.x, tip.y, facing)
    if (step >= 1) cells.push(tip)
  }
  return cells
}

function tunnelPreviewMachines(
  entrance: { x: number; y: number },
  exit: { x: number; y: number } | null,
  frame?: import('../model/frame.ts').PipelineFrame,
): StructurePreviewMachine[] {
  const facing = resolveTunnelFacing(entrance, exit, frame)
  const entranceValid = entrancePlacementValid(entrance, frame)
  const machines = [previewPortal(entrance, 'entrance', facing, entranceValid)]
  if (exit) {
    machines.push(previewPortal(exit, 'exit', facing, exitPlacementValid(entrance, exit, facing)))
  }
  return machines
}

function createFastTunnelSession(): StructurePlacementSession {
  let exit: { x: number; y: number } | null = null
  let entrance = tunnelPendingEntrance()

  return {
    push(cell) {
      if (entrance) {
        exit = cell
        return true
      }
      entrance = cell
      markTunnelEntrance(cell)
      return true
    },
    previewBelts() {
      return []
    },
    previewMachine() {
      return null
    },
    previewMachines() {
      if (!entrance) return []
      return tunnelPreviewMachines(entrance, exit, getPlacementFrame() ?? undefined)
    },
    previewHintCells() {
      if (!entrance) return []
      const facing = resolveLogisticFacing(entrance, getPlacementFrame())
      return validExitCells(entrance, facing)
    },
    isEmpty() {
      return !entrance && !exit
    },
    finish() {
      if (!entrance || !exit) return null
      const frame = getPlacementFrame()
      const facing = resolveTunnelFacing(entrance, exit, frame)
      const geom = tunnelPairGeometry(entrance, exit, facing, tunnelMaxGap())
      clearTunnelPlacement()
      if (!geom.ok) return null
      return {
        structureId: 'fast_tunnel',
        payload: {
          machineId: 'fast_tunnel',
          entranceX: entrance.x,
          entranceY: entrance.y,
          exitX: exit.x,
          exitY: exit.y,
          facing,
        } satisfies FastTunnelPayload,
      }
    },
  }
}

function fastTunnelHoverGhost(
  cell: { x: number; y: number },
  frame?: import('../model/frame.ts').PipelineFrame,
): StructureHoverGhost {
  const entrance = tunnelPendingEntrance()
  if (entrance) {
    const facing = resolveTunnelFacing(entrance, cell, frame)
    return {
      machines: tunnelPreviewMachines(entrance, cell, frame),
      hintCells: validExitCells(entrance, facing),
    }
  }
  const facing = resolveLogisticFacing(cell, frame)
  const entranceValid = entrancePlacementValid(cell, frame)
  return {
    machine: previewPortal(cell, 'entrance', facing, entranceValid),
    hintCells: validExitCells(cell, facing),
  }
}

const fastTunnelStructure: StructureDefinition = {
  id: 'fast_tunnel',
  label: 'Túnel rápido',
  iconSrc: '/pipeline/structure-fast-tunnel.svg',
  signInMessage: 'Entre para colocar túneis rápidos.',
  createSession: createFastTunnelSession,
  hoverGhost: fastTunnelHoverGhost,
  placementHints: () => {
    const entrance = tunnelPendingEntrance()
    if (!entrance) return []
    const facing = resolveLogisticFacing(entrance, getPlacementFrame())
    return validExitCells(entrance, facing)
  },
  rotate: () => {
    cycleCombinerFacing()
  },
  async commit(ctx, payload) {
    if (!isFastTunnelPayload(payload)) return
    await ctx.request(`/api/rooms/${ctx.roomId}/place-machine`, {
      machineId: 'fast_tunnel',
      entranceX: payload.entranceX,
      entranceY: payload.entranceY,
      exitX: payload.exitX,
      exitY: payload.exitY,
      facing: payload.facing,
    })
  },
}

registerStructure(fastTunnelStructure)

export { fastTunnelStructure }