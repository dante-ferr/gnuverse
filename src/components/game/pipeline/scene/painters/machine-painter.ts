import type { PipelineFrame, PipelineRules } from '../../model/frame.ts'
import { cellSize } from './grid-painter.ts'

/** Draws fixed machines. SVG sprites sit on the footprint when they have loaded. */
export class MachinePainter {
  constructor(
    private readonly coreImage: HTMLImageElement | null,
    private readonly sourceImage: HTMLImageElement | null,
  ) {}

  draw(ctx: CanvasRenderingContext2D, frame: PipelineFrame, rules: PipelineRules) {
    this.sprite(
      ctx,
      this.coreImage,
      frame.core.x,
      frame.core.y,
      5,
      rules.colorCore,
    )
    this.sprite(
      ctx,
      this.sourceImage,
      frame.source.x,
      frame.source.y,
      1,
      rules.colorSource,
    )
    for (const packet of frame.packets) {
      ctx.beginPath()
      ctx.fillStyle = rules.colorPacket
      ctx.arc(
        (packet.x + 0.5) * cellSize,
        (packet.y + 0.5) * cellSize,
        cellSize * 0.22,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }

  private sprite(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement | null,
    x: number,
    y: number,
    size: number,
    fallback: string,
  ) {
    const px = x * cellSize
    const py = y * cellSize
    const span = size * cellSize
    if (image && image.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, px, py, span, span)
      return
    }
    ctx.fillStyle = fallback
    ctx.fillRect(px + 4, py + 4, span - 8, span - 8)
  }
}
