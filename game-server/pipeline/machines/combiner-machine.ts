import type { Cell } from '../geometry/cell.ts'
import { ahead, opposite, type Direction } from '../geometry/direction.ts'
import { Machine } from './machine.ts'
import { Slot } from './slot.ts'

export type CombinerMachineId = 'combiner_2' | 'combiner_3'

/** Craft combiner with buffered inputs and timed output eject. */
export class CombinerMachine extends Machine {
  readonly kind = 'combiner'
  readonly machineId: CombinerMachineId
  /** Set when a buffered recipe match starts crafting; cleared after eject. */
  activeRecipeId: string | null = null
  readonly facing: Direction
  buffer: Record<string, number> = {}
  craftRemaining: number | null = null
  pendingOutputs: string[] | null = null
  nextSplitPort: 0 | 1 = 0

  constructor(
    id: string,
    machineId: CombinerMachineId,
    origin: Cell,
    facing: Direction = 'east',
  ) {
    const { width, height } = CombinerMachine.sizeFor(machineId, facing)
    super(id, origin, width, height)
    this.machineId = machineId
    this.facing = facing
    const inputCount = machineId === 'combiner_2' ? 2 : 3
    const outputCount = machineId === 'combiner_2' ? 1 : 2
    const back = opposite(facing)
    for (const local of faceLocals(width, height, back, inputCount)) {
      const world = { x: origin.x + local.x, y: origin.y + local.y }
      this.addSlot(new Slot(`${id}:in:${world.x},${world.y}`, 'input', world, facing))
    }
    for (const local of faceLocals(width, height, facing, outputCount)) {
      const rim = { x: origin.x + local.x, y: origin.y + local.y }
      const world = ahead(rim.x, rim.y, facing)
      this.addSlot(new Slot(`${id}:out:${world.x},${world.y}`, 'output', world, facing))
    }
  }

  /**
   * Footprint for the machine. Combiner_3 long axis follows facing
   * (5×3 east/west, 3×5 north/south). Decor stays upright and centered.
   */
  static sizeFor(
    machineId: CombinerMachineId,
    facing: Direction = 'east',
  ): { width: number; height: number } {
    if (machineId === 'combiner_2') return { width: 3, height: 3 }
    if (facing === 'east' || facing === 'west') return { width: 5, height: 3 }
    return { width: 3, height: 5 }
  }

  /** Output slots ordered for split / coupled eject (ports 0 and 1). */
  orderedOutputSlots(): Slot[] {
    const slots = this.outputSlots()
    return slots.slice().sort((a, b) => a.cell.y - b.cell.y || a.cell.x - b.cell.x)
  }
}

/** Evenly spaced local cells along one footprint face (ends preferred). */
function faceLocals(
  width: number,
  height: number,
  face: Direction,
  count: number,
): Cell[] {
  if (count < 1) return []
  if (face === 'west' || face === 'east') {
    const x = face === 'west' ? 0 : width - 1
    return sampleIndices(height, count).map((y) => ({ x, y }))
  }
  const y = face === 'north' ? 0 : height - 1
  return sampleIndices(width, count).map((x) => ({ x, y }))
}

/** Pick `count` indices in `0 .. length-1`, preferring ends then center. */
function sampleIndices(length: number, count: number): number[] {
  if (count >= length) return Array.from({ length }, (_, i) => i)
  if (count === 1) return [Math.floor((length - 1) / 2)]
  if (count === 2) return [0, length - 1]
  if (count === 3) return [0, Math.floor((length - 1) / 2), length - 1]
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    out.push(Math.round((i * (length - 1)) / (count - 1)))
  }
  return out
}
