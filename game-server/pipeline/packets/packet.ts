import type { Cell } from '../geometry/cell.ts'

/** Element id from the catalog, or the interim circle shape. */
export type PacketShape = string

/** One geometric packet occupying a single cell. */
export class Packet {
  readonly id: string
  cell: Cell
  readonly shape: PacketShape

  constructor(id: string, cell: Cell, shape: PacketShape = 'circle') {
    this.id = id
    this.cell = cell
    this.shape = shape
  }
}