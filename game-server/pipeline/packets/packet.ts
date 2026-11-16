import type { Cell } from '../geometry/cell.ts'

export type PacketShape = 'circle'

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
