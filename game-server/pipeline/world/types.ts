import type { Cell } from '../geometry/cell.ts'
import type { Direction } from '../geometry/direction.ts'

export type SourceRole = 'fire' | 'water' | 'circle'

export type PlacedSource = {
  id: string
  origin: Cell
  direction: Direction
  shape: 'circle'
  role: SourceRole
}

export type OccupiedMachine =
  | { kind: 'core'; origin: Cell }
  | { kind: 'source'; origin: Cell; direction: Direction }