import type { Cell } from '../geometry/cell.ts'
import { opposite, type Direction } from '../geometry/direction.ts'
import { Machine } from './machine.ts'
import { Slot } from './slot.ts'

/** 4×4 sink: one back-face input destroys any packet on intake. */
export class TrashcanMachine extends Machine {
  static readonly width = 4
  static readonly height = 4

  readonly kind = 'trashcan'
  readonly facing: Direction
  readonly authorId: string
  readonly authorNickname: string

  constructor(
    id: string,
    origin: Cell,
    facing: Direction = 'east',
    author: { id: string; nickname: string } = { id: '', nickname: '' },
  ) {
    super(id, origin, TrashcanMachine.width, TrashcanMachine.height)
    this.facing = facing
    this.authorId = author.id
    this.authorNickname = author.nickname
    const back = opposite(facing)
    for (const local of faceLocals(TrashcanMachine.width, TrashcanMachine.height, back, 1)) {
      const world = { x: origin.x + local.x, y: origin.y + local.y }
      this.addSlot(new Slot(`${id}:in:${world.x},${world.y}`, 'input', world, facing))
    }
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