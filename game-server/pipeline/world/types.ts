import type { Cell } from '../geometry/cell.ts'
import type { Direction } from '../geometry/direction.ts'

/** Element id emitted by this source (from `elements.toml`). */
export type SourceRole = string

export type PlacedSource = {
  id: string
  origin: Cell
  direction: Direction
  /** Interim packet geometry until element packets replace circles. */
  shape: 'circle'
  /** Catalog element id this source emits / represents. */
  role: SourceRole
  sourcePeriodTicks: number
}

export type OccupiedMachine =
  | { kind: 'core'; origin: Cell }
  | { kind: 'source'; origin: Cell; direction: Direction }