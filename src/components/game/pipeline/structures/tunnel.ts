import { tunnelPairGeometry } from '../../../../../game-server/pipeline/machines/tunnel-machine.ts'
import { cycleCombinerFacing, getCombinerPlaceOptions } from '../combiner-place-options.ts'
import { getPlacementRules } from '../placement-rules.ts'
import type { Direction } from '../model/frame.ts'
import { registerStructure } from './registry.ts'
import type {
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
  return tunnelPairGeometry(entrance, exit, facing, tunnelMaxGap()).ok
}

function tunnelPreviewMachines(
  entrance: { x: number; y: number },
  exit: { x: number; y: number } | null,
): StructurePreviewMachine[] {
  const { facing } = getCombinerPlaceOptions()
  const machines = [previewPortal(entrance, 'entrance', facing)]
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
      pendingEntrance = cell
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
      return tunnelPreviewMachines(entrance, exit)
    },
    isEmpty() {
      return !entrance && !exit
    },
    finish() {
      if (!entrance || !exit) return null
      const { facing } = getCombinerPlaceOptions()
      const geom = tunnelPairGeometry(entrance, exit, facing, tunnelMaxGap())
      pendingEntrance = null
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

function tunnelHoverGhost(cell: { x: number; y: number }): StructureHoverGhost {
  const { facing } = getCombinerPlaceOptions()
  if (pendingEntrance) {
    const valid = exitPlacementValid(pendingEntrance, cell, facing)
    return {
      machines: tunnelPreviewMachines(pendingEntrance, cell).map((machine) =>
        machine.tunnelRole === 'exit' ? { ...machine, placementValid: valid } : machine,
      ),
    }
  }
  return { machine: previewPortal(cell, 'entrance', facing) }
}

const tunnelStructure: StructureDefinition = {
  id: 'tunnel',
  label: 'Túnel',
  iconSrc: '/pipeline/structure-tunnel.svg',
  signInMessage: 'Entre para colocar túneis.',
  createSession: createTunnelSession,
  hoverGhost: tunnelHoverGhost,
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