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
import { registerStructure } from './registry.ts'
import type {
  GridCell,
  StructureDefinition,
  StructureHoverGhost,
  StructurePlacementSession,
  StructurePreviewMachine,
} from './types.ts'

type TunnelPayload = {
  machineId: 'tunnel'
  entranceX: number
  entranceY: number
  exitX: number
  exitY: number
  facing: Direction
}

function isTunnelPayload(payload: unknown): payload is TunnelPayload {
  if (!payload || typeof payload !== 'object') return false
  const record = payload as TunnelPayload
  return (
    record.machineId === 'tunnel' &&
    typeof record.entranceX === 'number' &&
    typeof record.entranceY === 'number' &&
    typeof record.exitX === 'number' &&
    typeof record.exitY === 'number'
  )
}

/** Entrance cell chosen on the first click; cleared after commit or cancel. */
let pendingEntrance: { x: number; y: number } | null = null

export function clearTunnelPlacement() {
  pendingEntrance = null
}

export function tunnelPlacementPending(): boolean {
  return pendingEntrance !== null
}

export function tunnelPendingEntrance() {
  return pendingEntrance
}

export function markTunnelEntrance(cell: { x: number; y: number }) {
  pendingEntrance = cell
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
    machineId: 'tunnel',
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

/**
 * Exit cells on the travel ray from entrance with gap `0..tunnelMaxGap`
 * (Factorio-style: exit is `gap + 1` steps ahead).
 */
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

function createTunnelSession(): StructurePlacementSession {
  let exit: { x: number; y: number } | null = null
  let entrance = pendingEntrance

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
        structureId: 'tunnel',
        payload: {
          machineId: 'tunnel',
          entranceX: entrance.x,
          entranceY: entrance.y,
          exitX: exit.x,
          exitY: exit.y,
          facing,
        } satisfies TunnelPayload,
      }
    },
  }
}

function tunnelHoverGhost(
  cell: { x: number; y: number },
  frame?: import('../model/frame.ts').PipelineFrame,
): StructureHoverGhost {
  if (pendingEntrance) {
    const facing = resolveTunnelFacing(pendingEntrance, cell, frame)
    return {
      machines: tunnelPreviewMachines(pendingEntrance, cell, frame),
      hintCells: validExitCells(pendingEntrance, facing),
    }
  }
  const facing = resolveLogisticFacing(cell, frame)
  const entranceValid = entrancePlacementValid(cell, frame)
  return {
    machine: previewPortal(cell, 'entrance', facing, entranceValid),
    hintCells: validExitCells(cell, facing),
  }
}

const tunnelStructure: StructureDefinition = {
  id: 'tunnel',
  label: 'Túnel',
  iconSrc: '/pipeline/structure-tunnel.svg',
  signInMessage: 'Entre para colocar túneis.',
  createSession: createTunnelSession,
  hoverGhost: tunnelHoverGhost,
  placementHints: () => {
    if (!pendingEntrance) return []
    const facing = resolveLogisticFacing(pendingEntrance, getPlacementFrame())
    return validExitCells(pendingEntrance, facing)
  },
  rotate: () => {
    cycleCombinerFacing()
  },
  async commit(ctx, payload) {
    if (!isTunnelPayload(payload)) return
    await ctx.request(`/api/towers/${ctx.roomId}/place-machine`, {
      machineId: 'tunnel',
      entranceX: payload.entranceX,
      entranceY: payload.entranceY,
      exitX: payload.exitX,
      exitY: payload.exitY,
      facing: payload.facing,
    })
  },
}

registerStructure(tunnelStructure)

export { tunnelStructure }