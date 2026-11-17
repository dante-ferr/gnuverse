import type { PipelineFrame, PipelineRules } from '../../model/frame.ts'
import { cellSize } from './grid-painter.ts'

/** Deliveries and version sit on the core. Blame sits on the hovered belt. */
export class ReadoutPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    rules: PipelineRules,
    hover: { x: number; y: number; nickname: string } | null,
  ) {
    const coreX = (frame.core.x + 2.5) * cellSize
    const below = (frame.core.y + 5) * cellSize + 18
    ctx.fillStyle = rules.colorBelt
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Entregas ${frame.deliveries}`, coreX, below)
    ctx.fillText(
      frame.collaborators.length === 1
        ? '1 colaborador'
        : `${frame.collaborators.length} colaboradores`,
      coreX,
      below + 16,
    )
    ctx.fillText('v0.1', coreX, (frame.core.y + 2.5) * cellSize)
    if (hover) {
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