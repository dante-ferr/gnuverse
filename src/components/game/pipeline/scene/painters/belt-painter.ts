import type { BeltRecord, PipelineRules } from '../../model/frame.ts'
import { ahead } from '../grid-math.ts'
import { cellSize } from './grid-painter.ts'

/** Draws connected belt cells as rounded tracks with a chevron. */
export class BeltPainter {
  draw(ctx: CanvasRenderingContext2D, belts: BeltRecord[], rules: PipelineRules) {
    ctx.strokeStyle = rules.colorBelt
    ctx.fillStyle = rules.colorBelt
    ctx.lineWidth = cellSize * 0.34
    ctx.lineCap = 'round'
    for (const belt of belts) {
      const enter = ahead(belt.x, belt.y, opposite(belt.direction))
      const start = point(enter.x, enter.y, belt.x, belt.y)
      const end = point(belt.x, belt.y, ahead(belt.x, belt.y, belt.direction).x, ahead(belt.x, belt.y, belt.direction).y)
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
      chevron(ctx, belt, rules.colorBackground)
    }
  }
}

function opposite(direction: BeltRecord['direction']): BeltRecord['direction'] {
  if (direction === 'north') return 'south'
  if (direction === 'south') return 'north'
  if (direction === 'east') return 'west'
  return 'east'
}

function point(fromX: number, fromY: number, toX: number, toY: number) {
  return {
    x: ((fromX + toX) / 2 + 0.5) * cellSize,
    y: ((fromY + toY) / 2 + 0.5) * cellSize,
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
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-6, -5)
  ctx.lineTo(2, 0)
  ctx.lineTo(-6, 5)
  ctx.stroke()
  ctx.restore()
}
