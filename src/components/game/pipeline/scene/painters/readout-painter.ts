import type { PipelineFrame, PipelineRules } from '../../model/frame.ts'
import { cellSize } from './grid-painter.ts'

/** Git blame on hover; deliveries and version live in the room sidebar. */
export class ReadoutPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    _frame: PipelineFrame,
    rules: PipelineRules,
    hover: { x: number; y: number; nickname: string } | null,
  ) {
    if (!hover) return
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'left'
    const label = hover.nickname
    const width = ctx.measureText(label).width + 12
    const x = (hover.x + 1) * cellSize
    const y = hover.y * cellSize - 6
    ctx.fillStyle = rules.colorCore
    roundRect(ctx, x, y, width, 18, 4)
    ctx.fill()
    ctx.fillStyle = rules.colorBackground
    ctx.fillText(label, x + 6, y + 13)
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.roundRect(x, y, Math.max(0, width), height, radius)
}