import { resolveBeltPlaceDirection } from '../belt-inbound.ts'
import { cycleBeltPlaceDirection } from '../belt-place-options.ts'
import type { PipelineFrame } from '../model/frame.ts'
import { planBeltCrossings, readBeltCrossQuery, type PlannedTunnel } from '../scene/belt-cross.ts'
import { BeltStroke, type StrokeCell } from '../scene/belt-stroke.ts'
import { registerStructure } from './registry.ts'
import type {
  StructureDefinition,
  StructureHoverGhost,
  StructurePlacementSession,
  StructurePreviewBelt,
  StructurePreviewMachine,
} from './types.ts'

function placementBelts() {
  return readBeltCrossQuery().belts?.() ?? []
}

type BeltPayload = {
  cells: StrokeCell[]
  tunnels?: PlannedTunnel[]
  /** Belts removed so a tunnel portal can occupy that cell. */
  clearBelts?: { x: number; y: number }[]
}

function isBeltPayload(payload: unknown): payload is BeltPayload {
  if (!payload || typeof payload !== 'object') return false
  const record = payload as BeltPayload
  if (!Array.isArray(record.cells)) return false
  if (record.tunnels != null && !Array.isArray(record.tunnels)) return false
  return record.clearBelts == null || Array.isArray(record.clearBelts)
}

function previewPortal(
  tunnel: PlannedTunnel,
  role: 'entrance' | 'exit',
): StructurePreviewMachine {
  return {
    machineId: 'tunnel',
    x: role === 'entrance' ? tunnel.entranceX : tunnel.exitX,
    y: role === 'entrance' ? tunnel.entranceY : tunnel.exitY,
    facing: tunnel.facing,
    width: 1,
    height: 1,
    tunnelRole: role,
    placementValid: true,
  }
}

function createBeltSession(): StructurePlacementSession {
  const stroke = new BeltStroke(undefined, (cell) =>
    resolveBeltPlaceDirection(cell, placementBelts()),
  )

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
        authorId: '',
        authorNickname: '',
        placedAt: index,
      }))
    },
    previewMachines(): StructurePreviewMachine[] {
      return plan().tunnels.flatMap((tunnel) => [
        previewPortal(tunnel, 'entrance'),
        previewPortal(tunnel, 'exit'),
      ])
    },
    isEmpty() {
      return stroke.cells.length === 0
    },
    finish() {
      const next = plan()
      if (next.belts.length === 0 && next.tunnels.length === 0) return null
      const payload: BeltPayload = { cells: next.belts }
      if (next.tunnels.length > 0) payload.tunnels = next.tunnels
      return { structureId: 'belt', payload }
    },
  }
}

function beltHoverGhost(
  cell: { x: number; y: number },
  frame?: PipelineFrame,
): StructureHoverGhost {
  const belts = frame?.belts ?? placementBelts()
  return {
    belts: [
      {
        id: 'hover-belt',
        x: cell.x,
        y: cell.y,
        direction: resolveBeltPlaceDirection(cell, belts),
        authorId: '',
        authorNickname: '',
        placedAt: 0,
      },
    ],
  }
}

const beltStructure: StructureDefinition = {
  id: 'belt',
  label: 'Esteira',
  iconSrc: '/pipeline/structure-belt.svg',
  signInMessage: 'Entre para colocar esteiras.',
  createSession: createBeltSession,
  hoverGhost: beltHoverGhost,
  rotate: () => {
    cycleBeltPlaceDirection()
  },
  async commit(ctx, payload) {
    if (!isBeltPayload(payload)) return
    for (const cell of payload.clearBelts ?? []) {
      await ctx.request(`/api/towers/${ctx.roomId}/remove`, cell)
    }
    for (const tunnel of payload.tunnels ?? []) {
      await ctx.request(`/api/towers/${ctx.roomId}/place-machine`, {
        machineId: 'tunnel',
        entranceX: tunnel.entranceX,
        entranceY: tunnel.entranceY,
        exitX: tunnel.exitX,
        exitY: tunnel.exitY,
        facing: tunnel.facing,
      })
    }
    if (payload.cells.length === 0) return
    await ctx.request(`/api/towers/${ctx.roomId}/place`, { cells: payload.cells })
  },
}

registerStructure(beltStructure)

export { beltStructure }
