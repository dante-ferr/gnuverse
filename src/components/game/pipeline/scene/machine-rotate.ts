import { opposite } from '../../../../../game-server/pipeline/geometry/direction.ts'
import type { Direction, PipelineFrame } from '../model/frame.ts'
import type { StructurePlacementSession, StructurePreviewMachine } from '../structures/types.ts'
import { CombinerMachine } from '../../../../../game-server/pipeline/machines/combiner-machine.ts'

export type MachineRotatePayload = {
  rotate: true
  machineId: string
  facing: Direction
  x?: number
  y?: number
  entranceX?: number
  entranceY?: number
  exitX?: number
  exitY?: number
}

export type MachineRotation = {
  payload: MachineRotatePayload
  /** Existing machine to hide while the rotated one is previewed. */
  hide: { kind: 'combiner' | 'splitter' | 'trashcan' | 'tunnel'; id: string }
  /** Opaque preview of the machine after rotation. */
  ghosts: StructurePreviewMachine[]
}

/**
 * A click with a machine tool on an existing machine of the same kind that
 * faces another way re-orients it in place (free). Tunnels only reverse.
 */
export function machineRotationFromClick(
  frame: PipelineFrame,
  cell: { x: number; y: number },
  structureId: string,
  facing: Direction,
): MachineRotation | null {
  const at = (x: number, y: number, w = 1, h = 1) =>
    cell.x >= x && cell.x < x + w && cell.y >= y && cell.y < y + h
  if (structureId === 'splitter') {
    const found = (frame.splitters ?? []).find((m) => at(m.x, m.y))
    if (!found || found.facing === facing) return null
    return {
      payload: { rotate: true, machineId: 'splitter', x: cell.x, y: cell.y, facing },
      hide: { kind: 'splitter', id: found.id },
      ghosts: [{ machineId: 'splitter', x: found.x, y: found.y, facing, width: 1, height: 1, opaque: true }],
    }
  }
  if (structureId === 'trashcan') {
    const found = (frame.trashcans ?? []).find((m) => at(m.x, m.y, 2, 2))
    if (!found || found.facing === facing) return null
    return {
      payload: { rotate: true, machineId: 'trashcan', x: cell.x, y: cell.y, facing },
      hide: { kind: 'trashcan', id: found.id },
      ghosts: [{ machineId: 'trashcan', x: found.x, y: found.y, facing, width: 2, height: 2, opaque: true }],
    }
  }
  if (structureId === 'combiner_2' || structureId === 'combiner_3') {
    const found = (frame.combiners ?? []).find((m) => {
      if (m.machineId !== structureId) return false
      const size = CombinerMachine.sizeFor(m.machineId, m.facing)
      return at(m.x, m.y, size.width, size.height)
    })
    if (!found || found.facing === facing) return null
    const old = CombinerMachine.sizeFor(found.machineId, found.facing)
    const next = CombinerMachine.sizeFor(found.machineId, facing)
    return {
      payload: { rotate: true, machineId: structureId, x: cell.x, y: cell.y, facing },
      hide: { kind: 'combiner', id: found.id },
      ghosts: [
        {
          machineId: found.machineId,
          x: found.x + Math.floor((old.width - 1) / 2) - Math.floor((next.width - 1) / 2),
          y: found.y + Math.floor((old.height - 1) / 2) - Math.floor((next.height - 1) / 2),
          facing,
          width: next.width,
          height: next.height,
          opaque: true,
        },
      ],
    }
  }
  if (structureId === 'tunnel' || structureId === 'fast_tunnel') {
    const portal = (frame.tunnels ?? []).find((m) => m.x === cell.x && m.y === cell.y)
    if (!portal || facing !== opposite(portal.direction)) return null
    const mate = (frame.tunnels ?? []).find(
      (m) => m.pairId === portal.pairId && m.id !== portal.id,
    )
    if (!mate) return null
    const ghost = (
      at: { x: number; y: number },
      tunnelRole: 'entrance' | 'exit',
    ): StructurePreviewMachine => ({
      machineId: structureId as 'tunnel' | 'fast_tunnel',
      x: at.x,
      y: at.y,
      facing,
      width: 1,
      height: 1,
      tunnelRole,
      opaque: true,
    })
    const entrance = portal.role === 'entrance' ? portal : mate
    const exit = portal.role === 'entrance' ? mate : portal
    return {
      payload: {
        rotate: true,
        machineId: structureId,
        entranceX: cell.x,
        entranceY: cell.y,
        facing,
      },
      hide: { kind: 'tunnel', id: portal.pairId },
      ghosts: [ghost(exit, 'entrance'), ghost(entrance, 'exit')],
    }
  }
  return null
}

/** One-shot session whose click commits an in-place rotation. */
export function createMachineRotateSession(payload: MachineRotatePayload): StructurePlacementSession {
  return {
    push: () => false,
    previewBelts: () => [],
    isEmpty: () => false,
    finish: () => ({ structureId: payload.machineId, payload }),
  }
}
