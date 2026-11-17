import type { BeltRecord, Direction, PipelineRules } from '../../model/frame.ts'
import { ahead } from '../grid-math.ts'
import { cellSize } from './grid-painter.ts'

/** Draws connected belt cells as rounded tracks with a chevron. */
export class BeltPainter {
  draw(ctx: CanvasRenderingContext2D, belts: BeltRecord[], rules: PipelineRules) {
    const byCell = new Map(belts.map((b) => [`${b.x},${b.y}`, b]))
    ctx.strokeStyle = rules.colorBelt
    ctx.fillStyle = rules.colorBelt
    ctx.lineWidth = cellSize * 0.88
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
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
      ctx.stroke()
      chevron(ctx, belt, rules.colorBackground)
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

function chevron(
  ctx: CanvasRenderingContext2D,
  belt: BeltRecord,
  color: string,
) {
  const cx = (belt.x + 0.5) * cellSize
  const cy = (belt.y + 0.5) * cellSize
  const angle = { east: 0, south: Math.PI / 2, west: Math.PI, north: -Math.PI / 2 }[belt.direction]
  const arm = cellSize * 0.14
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(2, cellSize * 0.045)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(-arm, -arm * 0.85)
  ctx.lineTo(arm * 0.35, 0)
  ctx.lineTo(-arm, arm * 0.85)
  ctx.stroke()
  ctx.restore()
}