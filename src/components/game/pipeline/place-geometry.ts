import type { GridCell } from './structures/types.ts'

/** Footprint origin so `center` is the machine's center cell. */
export function originFromCenter(center: GridCell, width: number, height: number): GridCell {
  return {
    x: center.x - Math.floor((width - 1) / 2),
    y: center.y - Math.floor((height - 1) / 2),
  }
}
