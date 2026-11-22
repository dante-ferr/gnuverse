import { planBeltCrossings, readBeltCrossQuery, type PlannedTunnel } from '../scene/belt-cross.ts'
import { BeltStroke, type StrokeCell } from '../scene/belt-stroke.ts'
import { getPlacementRules } from '../placement-rules.ts'
import type {
  StructureCommitContext,
  StructurePlacementSession,
  StructurePreviewBelt,
  StructurePreviewMachine,
} from './types.ts'

export type BeltPlaceOptions = {
  structureId: 'belt' | 'fast_belt'
  speed: number
  tunnelMachineId: 'tunnel' | 'fast_tunnel'
  previewSpeed?: number
}

export type BeltPayload = {
  cells: StrokeCell[]
  speed?: number
  tunnels?: PlannedTunnel[]
  clearBelts?: { x: number; y: number }[]
}

export function isBeltPayload(payload: unknown): payload is BeltPayload {
  if (!payload || typeof payload !== 'object') return false
  const record = payload as BeltPayload
  if (!Array.isArray(record.cells)) return false
  if (record.tunnels != null && !Array.isArray(record.tunnels)) return false
  return record.clearBelts == null || Array.isArray(record.clearBelts)
}

function previewPortal(
  tunnel: PlannedTunnel,
  role: 'entrance' | 'exit',
  tunnelMachineId: 'tunnel' | 'fast_tunnel',
): StructurePreviewMachine {
  return {
    machineId: tunnelMachineId,
    x: role === 'entrance' ? tunnel.entranceX : tunnel.exitX,
    y: role === 'entrance' ? tunnel.entranceY : tunnel.exitY,
    facing: tunnel.facing,
    width: 1,
    height: 1,
    tunnelRole: role,
    placementValid: true,
  }
}

export function createBeltStrokeSession(options: BeltPlaceOptions): StructurePlacementSession {
  const stroke = new BeltStroke()
  const previewSpeed = options.previewSpeed ?? options.speed

  const plan = () => {
    const query = readBeltCrossQuery()
    const { conveyors, blocked } = query.occupancy()
    return planBeltCrossings(
      stroke.cells,
      conveyors,
      blocked,
      query.maxGap(),
      query.ports?.() ?? [],
    )
  }

  return {
    push(cell) {
      return stroke.push(cell)
    },
    previewBelts(): StructurePreviewBelt[] {
      return plan().belts.map((cell, index) => ({
        id: `preview-${index}`,
        x: cell.x,
        y: cell.y,
        direction: cell.direction,
        speed: previewSpeed,
        authorId: '',
        authorNickname: '',
        placedAt: index,
      }))
    },
    previewMachines(): StructurePreviewMachine[] {
      return plan().tunnels.flatMap((tunnel) => [
        previewPortal(tunnel, 'entrance', options.tunnelMachineId),
        previewPortal(tunnel, 'exit', options.tunnelMachineId),
      ])
    },
    isEmpty() {
      return stroke.cells.length === 0
    },
    finish() {
      const next = plan()
      if (next.belts.length === 0 && next.tunnels.length === 0) return null
      const payload: BeltPayload = { cells: next.belts }
      if (options.speed > 1) payload.speed = options.speed
      if (next.tunnels.length > 0) payload.tunnels = next.tunnels
      return { structureId: options.structureId, payload }
    },
  }
}

export function beltHoverPreview(
  cell: { x: number; y: number },
  direction: import('../model/frame.ts').Direction,
  speed: number,
): StructurePreviewBelt {
  return {
    id: 'hover-belt',
    x: cell.x,
    y: cell.y,
    direction,
    speed,
    authorId: '',
    authorNickname: '',
    placedAt: 0,
  }
}

export async function commitBeltPayload(
  ctx: StructureCommitContext,
  payload: BeltPayload,
  options: BeltPlaceOptions,
) {
  const rules = getPlacementRules()
  for (const cell of payload.clearBelts ?? []) {
    await ctx.request(`/api/rooms/${ctx.roomId}/remove`, cell)
  }
  for (const tunnel of payload.tunnels ?? []) {
    await ctx.request(`/api/rooms/${ctx.roomId}/place-machine`, {
      machineId: options.tunnelMachineId,
      entranceX: tunnel.entranceX,
      entranceY: tunnel.entranceY,
      exitX: tunnel.exitX,
      exitY: tunnel.exitY,
      facing: tunnel.facing,
    })
  }
  if (payload.cells.length === 0) return
  const body: { cells: StrokeCell[]; speed?: number } = { cells: payload.cells }
  if (options.structureId === 'fast_belt') {
    const fastSpeed = rules?.beltSpeedFast
    if (fastSpeed == null || fastSpeed <= 1) return
    body.speed = fastSpeed
  }
  await ctx.request(`/api/rooms/${ctx.roomId}/place`, body)
}