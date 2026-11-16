import type { PipelineFrame, PipelineRules } from '../../model/frame.ts'
import { cellSize } from './grid-painter.ts'

/** Stability, deliveries, and version sit on the core. Blame sits on the hovered belt. */
export class ReadoutPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    rules: PipelineRules,
    hover: { x: number; y: number; nickname: string } | null,
  ) {
    const coreX = (frame.core.x + 2.5) * cellSize
    const top = frame.core.y * cellSize - 28
    const ratio = Math.max(0, Math.min(1, frame.stability / rules.stabilityCapacity))
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    roundRect(ctx, coreX - 70, top, 140, 16, 8)
    ctx.fill()
    ctx.fillStyle = ratio > 0.35 ? rules.colorStabilityOk : rules.colorStability
    roundRect(ctx, coreX - 68, top + 2, 136 * ratio, 12, 6)
    ctx.fill()
    ctx.fillStyle = rules.colorCore
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Estabilidade ${Math.round(frame.stability)}`, coreX, frame.core.y * cellSize - 36)
    const below = (frame.core.y + 5) * cellSize + 18
    ctx.fillText(`Entregas ${frame.deliveries}`, coreX, below)
    ctx.fillText(
      frame.collaborators.length === 1
        ? '1 colaborador'
        : `${frame.collaborators.length} colaboradores`,
      coreX,
      below + 16,
    )
    ctx.fillText('v0.1', coreX, (frame.core.y + 2.5) * cellSize)
    if (frame.crashed) {
      ctx.fillStyle = 'rgba(36, 24, 20, 0.72)'
      ctx.fillRect(0, 0, frame.width * cellSize, frame.height * cellSize)
      ctx.fillStyle = '#fff8f2'
      ctx.font = 'bold 28px sans-serif'
      ctx.fillText('Queda do sistema', coreX, (frame.core.y + 2.5) * cellSize)
    }
    if (hover) {
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'left'
      const label = hover.nickname
      const width = ctx.measureText(label).width + 12
      const x = (hover.x + 1) * cellSize
      const y = hover.y * cellSize - 6
      ctx.fillStyle = 'rgba(255,255,255,0.94)'
      roundRect(ctx, x, y, width, 18, 4)
      ctx.fill()
      ctx.fillStyle = rules.colorCore
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
