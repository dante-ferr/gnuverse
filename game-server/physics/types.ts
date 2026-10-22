import type { BLOCKS } from './catalog.ts'

export type BlockKind = keyof typeof BLOCKS
export type Placement = {
  id: string
  kind: BlockKind
  x: number
  y: number
  angle: number
  color: string
  authorId: string
}
export type BlockState = Placement & {
  vx: number
  vy: number
  angularVelocity: number
  sleeping: boolean
}
export type Frame = { blocks: BlockState[]; settled: boolean; tick: number }
export type InitialBlock = Placement &
  Partial<Pick<BlockState, 'vx' | 'vy' | 'angularVelocity' | 'sleeping'>>
export type PlaceResult =
  | { ok: true; error?: never }
  | {
      ok: false
      error: 'invalid' | 'busy' | 'limit' | 'duplicate' | 'bounds' | 'overlap'
    }
export type Simulation = {
  place(input: Placement): PlaceResult
  /** Arms a horizontal, gravity-relative acceleration for the next step only. */
  applyWind(strength: number, direction: 1 | -1): void
  step(): Frame
  read(): Frame
  restore(blocks: InitialBlock[]): void
  dispose(): void
}
