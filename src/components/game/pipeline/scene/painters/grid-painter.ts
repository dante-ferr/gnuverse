import type { PipelineFrame, PipelineRules } from '../../model/frame.ts'

const cellSize = 48

/** Draws the floor grid. */
export class GridPainter {
  draw(ctx: CanvasRenderingContext2D, frame: PipelineFrame, rules: PipelineRules) {
    ctx.fillStyle = rules.colorBackground
    ctx.fillRect(0, 0, frame.width * cellSize, frame.height * cellSize)
    ctx.strokeStyle = rules.colorGrid
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x <= frame.width; x++) {
      ctx.moveTo(x * cellSize + 0.5, 0)
      ctx.lineTo(x * cellSize + 0.5, frame.height * cellSize)
    }
    for (let y = 0; y <= frame.height; y++) {
      ctx.moveTo(0, y * cellSize + 0.5)
      ctx.lineTo(frame.width * cellSize, y * cellSize + 0.5)
    }
    ctx.stroke()
  }
}

export { cellSize }
