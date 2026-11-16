import type { Cell } from '../geometry/cell.ts'
import type { Direction } from '../geometry/direction.ts'
import { Machine } from './machine.ts'
import { Slot } from './slot.ts'

/**
 * Central core. Footprint is 5×5.
 * Each face exposes the three central tiles as inputs. Corners are solid.
 * Four faces × three tiles = 12 input slots.
 */
export class CoreMachine extends Machine {
  readonly kind = 'core'
  static readonly size = 5

  constructor(id: string, origin: Cell) {
    super(id, origin, CoreMachine.size, CoreMachine.size)
    const faces: { travel: Direction; cells: Cell[] }[] = [
      { travel: 'south', cells: [cell(1, 0), cell(2, 0), cell(3, 0)] },
      { travel: 'north', cells: [cell(1, 4), cell(2, 4), cell(3, 4)] },
      { travel: 'east', cells: [cell(0, 1), cell(0, 2), cell(0, 3)] },
      { travel: 'west', cells: [cell(4, 1), cell(4, 2), cell(4, 3)] },
    ]
    for (const face of faces) {
      for (const local of face.cells) {
        const world = { x: origin.x + local.x, y: origin.y + local.y }
        this.addSlot(
          new Slot(`${id}:${world.x},${world.y}`, 'input', world, face.travel),
        )
      }
    }
  }
}

function cell(x: number, y: number): Cell {
  return { x, y }
}
