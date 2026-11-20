import type { Direction, PipelineFrame, PipelineRules, TunnelPortalRecord } from '../model/frame.ts'
import type {
  StructurePlacementSession,
  StructurePreviewMachine,
  StructurePlaceRequest,
} from '../structures/types.ts'

export type TunnelSpeedChangeSpec = {
  machineId: 'tunnel' | 'fast_tunnel'
  entranceX: number
  entranceY: number
  exitX: number
  exitY: number
  facing: Direction
}

/** Owned tunnel pair under `cell` when the selected tool would change its speed. */
export function tunnelSpeedChangeFromClick(
  frame: PipelineFrame,
  cell: { x: number; y: number },
  ownerId: string,
  rules: PipelineRules | null,
  target: 'tunnel' | 'fast_tunnel',
): TunnelSpeedChangeSpec | null {
  const portal = (frame.tunnels ?? []).find((item) => item.x === cell.x && item.y === cell.y)
  if (!portal || portal.authorId !== ownerId) return null
  const fastSpeed = rules?.beltSpeedFast ?? 0
  if (fastSpeed <= 1) return null
  const portalFast = (portal.speed ?? 1) === fastSpeed
  const wantFast = target === 'fast_tunnel'
  if (portalFast === wantFast) return null
  const pair = tunnelPairSpec(frame, portal)
  if (!pair) return null
  return { machineId: target, ...pair }
}

/** @deprecated Prefer `tunnelSpeedChangeFromClick`. */
export function tunnelUpgradeFromClick(
  frame: PipelineFrame,
  cell: { x: number; y: number },
  ownerId: string,
  rules: PipelineRules | null,
): TunnelSpeedChangeSpec | null {
  return tunnelSpeedChangeFromClick(frame, cell, ownerId, rules, 'fast_tunnel')
}

function tunnelPairSpec(
  frame: PipelineFrame,
  portal: TunnelPortalRecord,
): Omit<TunnelSpeedChangeSpec, 'machineId'> | null {
  const mate = (frame.tunnels ?? []).find(
    (item) => item.pairId === portal.pairId && item.id !== portal.id,
  )
  if (!mate) return null
  const entrance = portal.role === 'entrance' ? portal : mate
  const exit = portal.role === 'exit' ? portal : mate
  if (entrance.role !== 'entrance' || exit.role !== 'exit') return null
  return {
    entranceX: entrance.x,
    entranceY: entrance.y,
    exitX: exit.x,
    exitY: exit.y,
    facing: entrance.direction,
  }
}

/** One-shot session: click commits a speed change over the existing pair. */
export function createTunnelUpgradeSession(pair: TunnelSpeedChangeSpec): StructurePlacementSession {
  const preview = (role: 'entrance' | 'exit'): StructurePreviewMachine => ({
    machineId: pair.machineId,
    x: role === 'entrance' ? pair.entranceX : pair.exitX,
    y: role === 'entrance' ? pair.entranceY : pair.exitY,
    facing: pair.facing,
    width: 1,
    height: 1,
    tunnelRole: role,
    placementValid: true,
  })

  return {
    push() {
      return false
    },
    previewBelts() {
      return []
    },
    previewMachines() {
      return [preview('entrance'), preview('exit')]
    },
    isEmpty() {
      return false
    },
    finish(): StructurePlaceRequest {
      return {
        structureId: pair.machineId,
        payload: {
          machineId: pair.machineId,
          entranceX: pair.entranceX,
          entranceY: pair.entranceY,
          exitX: pair.exitX,
          exitY: pair.exitY,
          facing: pair.facing,
        },
      }
    },
  }
}
