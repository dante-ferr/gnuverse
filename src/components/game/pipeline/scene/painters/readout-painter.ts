import type { PipelineFrame, PipelineRules, PresencePlayer } from '../../model/frame.ts'
import { cellSize } from './grid-painter.ts'

/** Git blame on hover; deliveries and version live in the room sidebar. */
export class ReadoutPainter {
  /**
   * Name label with an arrow and a white square outline on the last cell each present player edited.
   * Sizes counter-scale with zoom so labels stay readable.
   */
  drawPresence(
    ctx: CanvasRenderingContext2D,
    players: PresencePlayer[],
    rules: PipelineRules,
    zoom: number,
    frame: PipelineFrame,
  ) {
    const s = Math.min(2.5, Math.max(0.6, 1 / Math.max(zoom, 0.01)))
    ctx.save()
    ctx.font = `${12 * s}px sans-serif`
    ctx.textAlign = 'left'
    for (const player of players) {
      const cell = player.cell
      if (!cell || cell.x < 0 || cell.y < 0 || cell.x >= frame.width || cell.y >= frame.height)
        continue
      const left = cell.x * cellSize
      const top = cell.y * cellSize
      // White square outline, with a dark halo so it reads on light tiles too.
      ctx.lineJoin = 'miter'
      ctx.strokeStyle = rules.colorBackground
      ctx.lineWidth = 4 * s
      ctx.strokeRect(left + 2 * s, top + 2 * s, cellSize - 4 * s, cellSize - 4 * s)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2 * s
      ctx.strokeRect(left + 2 * s, top + 2 * s, cellSize - 4 * s, cellSize - 4 * s)

      const width = ctx.measureText(player.nickname).width + 12 * s
      const height = 18 * s
      const arrow = 7 * s
      const gap = 3 * s
      const centerX = left + cellSize / 2
      const above = top - gap - arrow - height >= 0
      const boxY = above ? top - gap - arrow - height : top + cellSize + gap + arrow
      const tipY = above ? top - gap : top + cellSize + gap
      const baseY = above ? boxY + height : boxY
      const boxX = Math.max(0, Math.min(centerX - width / 2, frame.width * cellSize - width))
      ctx.fillStyle = rules.colorCore
      roundRect(ctx, boxX, boxY, width, height, 4 * s)
      ctx.fill()
      // Arrow from the label toward the edited cell.
      ctx.beginPath()
      ctx.moveTo(centerX - arrow, baseY)
      ctx.lineTo(centerX + arrow, baseY)
      ctx.lineTo(centerX, tipY)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = rules.colorBackground
      ctx.fillText(player.nickname, boxX + 6 * s, boxY + 13 * s)
    }
    ctx.restore()
  }

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