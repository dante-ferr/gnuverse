import type { BeltRecord, Direction, PipelineRules } from '../../model/frame.ts'
import { ahead } from '../grid-math.ts'
import { cellSize } from './grid-painter.ts'

/** Draws each belt cell as a square-ended track with chevrons clipped to that cell. */
export class BeltPainter {
  draw(ctx: CanvasRenderingContext2D, belts: BeltRecord[], rules: PipelineRules, timeMs: number) {
    const byCell = new Map(belts.map((b) => [`${b.x},${b.y}`, b]))
    const beltWidth = cellSize * 0.88
    for (const belt of belts) {
      const fromDir = enterSide(belt, byCell)
      const feeder = ahead(belt.x, belt.y, fromDir)
      const exit = ahead(belt.x, belt.y, belt.direction)
      const start = edgeMid(feeder, belt)
      const end = edgeMid(belt, exit)
      const cx = (belt.x + 0.5) * cellSize
      const cy = (belt.y + 0.5) * cellSize
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(cx, cy)
      ctx.lineTo(end.x, end.y)
      ctx.strokeStyle = rules.colorBelt
      ctx.lineWidth = beltWidth
      ctx.lineCap = 'butt'
      ctx.lineJoin = 'miter'
      ctx.stroke()
      chevrons(ctx, belt, rules, timeMs)
    }
  }
}

function enterSide(belt: BeltRecord, byCell: Map<string, BeltRecord>): Direction {
  const sides: Direction[] = ['north', 'south', 'east', 'west']
  for (const side of sides) {
    const neighborPos = ahead(belt.x, belt.y, side)
    const neighbor = byCell.get(`${neighborPos.x},${neighborPos.y}`)
    if (!neighbor) continue
    const dest = ahead(neighbor.x, neighbor.y, neighbor.direction)
    if (dest.x === belt.x && dest.y === belt.y) return side
  }
  return opposite(belt.direction)
}

function opposite(direction: Direction): Direction {
  if (direction === 'north') return 'south'
  if (direction === 'south') return 'north'
  if (direction === 'east') return 'west'
  return 'east'
}

function edgeMid(from: { x: number; y: number }, to: { x: number; y: number }) {
  return {
    x: ((from.x + to.x) / 2 + 0.5) * cellSize,
    y: ((from.y + to.y) / 2 + 0.5) * cellSize,
  }
}

function chevrons(ctx: CanvasRenderingContext2D, belt: BeltRecord, rules: PipelineRules, timeMs: number) {
  const delta = directionDelta(belt.direction)
  const alongAxis = delta.dx !== 0
  const sign = alongAxis ? delta.dx : delta.dy
  const step = cellSize * 0.42
  const travel = (timeMs / rules.beltChevronFlowMs) * cellSize * sign
  const center = (alongAxis ? belt.x : belt.y) * cellSize + cellSize / 2
  const cross = (alongAxis ? belt.y : belt.x) * cellSize + cellSize / 2
  const reach = cellSize * 0.25
  const min = center - cellSize / 2 - reach
  const max = center + cellSize / 2 + reach
  const first = Math.floor((min - travel) / step)
  const last = Math.ceil((max - travel) / step)

  ctx.save()
  ctx.beginPath()
  ctx.rect(belt.x * cellSize, belt.y * cellSize, cellSize, cellSize)
  ctx.clip()
  for (let n = first; n <= last; n++) {
    const coord = n * step + travel
    const x = alongAxis ? coord : cross
    const y = alongAxis ? cross : coord
    chevronAt(ctx, x, y, belt.direction, rules)
  }
  ctx.restore()
}

function directionDelta(direction: Direction) {
  if (direction === 'east') return { dx: 1, dy: 0 }
  if (direction === 'west') return { dx: -1, dy: 0 }
  if (direction === 'south') return { dx: 0, dy: 1 }
  return { dx: 0, dy: -1 }
}

function chevronAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: Direction,
  rules: PipelineRules,
) {
  const angle = { east: 0, south: Math.PI / 2, west: Math.PI, north: -Math.PI / 2 }[direction]
  const arm = cellSize * 0.14
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(-arm, -arm * 0.85)
  ctx.lineTo(arm * 0.35, 0)
  ctx.lineTo(-arm, arm * 0.85)
  ctx.strokeStyle = rules.colorBackground
  ctx.lineWidth = rules.beltChevronStrokePx
  ctx.stroke()
  ctx.restore()
}