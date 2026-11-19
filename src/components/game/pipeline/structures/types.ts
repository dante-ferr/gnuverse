import type { CombinerMachineId } from '../../../../../game-server/pipeline/machines/combiner-machine.ts'
import type { Direction } from '../model/frame'

export type GridCell = { x: number; y: number }

/** Belt-shaped preview cells drawn while a stroke tool is active. */
export type StructurePreviewBelt = {
  id: string
  x: number
  y: number
  direction: Direction
  authorId: string
  authorNickname: string
  placedAt: number
}

export type StructurePreviewMachine = {
  machineId: CombinerMachineId
  x: number
  y: number
  facing: Direction
  width: number
  height: number
}

export type StructureHoverGhost = {
  belts?: StructurePreviewBelt[]
  machine?: StructurePreviewMachine
}

export type StructurePlaceRequest = {
  structureId: string
  payload: unknown
}

export type StructureCommitContext = {
  roomId: string
  request: (
    path: string,
    body?: unknown,
    method?: 'GET' | 'POST' | 'DELETE',
  ) => Promise<unknown>
}

/** Active pointer drag for one structure while in create mode. */
export type StructurePlacementSession = {
  push(cell: GridCell): boolean
  previewBelts(): StructurePreviewBelt[]
  previewMachine?(): StructurePreviewMachine | null
  isEmpty(): boolean
  finish(): StructurePlaceRequest | null
}

/** One placeable structure. Registering it updates the sidebar and placement. */
export type StructureDefinition = {
  id: string
  label: string
  /** Public SVG path used as a CSS mask in the sidebar. */
  iconSrc: string
  /** When true, hide unless `frame.sandbox`. */
  sandboxOnly?: boolean
  /** Guest copy when placement is blocked. */
  signInMessage: string
  createSession: () => StructurePlacementSession
  commit: (ctx: StructureCommitContext, payload: unknown) => Promise<void>
  /** Hover ghost while selected in create mode (no drag required). */
  hoverGhost?: (cell: GridCell) => StructureHoverGhost | null
  /** Cycle facing / belt direction (R key). */
  rotate?: () => void
}
