import {
  cellChunkState,
  type ChunkCoord,
} from '../../../../../../game-server/pipeline/world/chunks.ts'
import type { PipelineFrame, PipelineRules } from '../../model/frame.ts'
import { darkenHex } from './darken-hex.ts'

const cellSize = 48

function frameChunks(frame: PipelineFrame, rules: PipelineRules) {
  const originChunk: ChunkCoord = frame.originChunk ?? { cx: 0, cy: 0 }
  const chunkSize = rules.chunkSize
  const owned: ChunkCoord[] =
    frame.ownedChunks ??
    (frame.width <= chunkSize && frame.height <= chunkSize
      ? [{ cx: originChunk.cx, cy: originChunk.cy }]
      : [])
  const preview: ChunkCoord[] = frame.previewChunks ?? []
  return { originChunk, owned, preview, chunkSize }
}

/** Draws the floor grid with owned, preview, and void regions. */
export class GridPainter {
  draw(ctx: CanvasRenderingContext2D, frame: PipelineFrame, rules: PipelineRules) {
    const { originChunk, owned, preview, chunkSize } = frameChunks(frame, rules)
    const voidFill = darkenHex(rules.colorBackground, 22)

    ctx.fillStyle = rules.colorBackground
    ctx.fillRect(0, 0, frame.width * cellSize, frame.height * cellSize)

    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const state = cellChunkState({ x, y }, owned, preview, originChunk, chunkSize)
        if (state !== 'void') continue
        ctx.fillStyle = voidFill
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
      }
    }

    ctx.strokeStyle = rules.colorGrid
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const state = cellChunkState({ x, y }, owned, preview, originChunk, chunkSize)
        if (state === 'void') continue
        const px = x * cellSize + 0.5
        const py = y * cellSize + 0.5
        ctx.moveTo(px, py)
        ctx.lineTo(px + cellSize, py)
        ctx.moveTo(px, py)
        ctx.lineTo(px, py + cellSize)
      }
    }
    ctx.stroke()

    this.drawChunkBorders(ctx, originChunk, owned, preview, chunkSize, rules)
  }

  drawPreviewOverlay(ctx: CanvasRenderingContext2D, frame: PipelineFrame, rules: PipelineRules) {
    const { originChunk, preview, chunkSize } = frameChunks(frame, rules)
    this.fillPreviewOverlay(ctx, originChunk, preview, chunkSize)
  }

  private drawChunkBorders(
    ctx: CanvasRenderingContext2D,
    originChunk: ChunkCoord,
    owned: ChunkCoord[],
    preview: ChunkCoord[],
    chunkSize: number,
    rules: PipelineRules,
  ) {
    const all = [...owned, ...preview]
    ctx.strokeStyle = rules.colorMuted
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.35
    for (const coord of all) {
      const lx = (coord.cx - originChunk.cx) * chunkSize
      const ly = (coord.cy - originChunk.cy) * chunkSize
      ctx.strokeRect(lx * cellSize + 0.5, ly * cellSize + 0.5, chunkSize * cellSize, chunkSize * cellSize)
    }
    ctx.globalAlpha = 1
  }

  private fillPreviewOverlay(
    ctx: CanvasRenderingContext2D,
    originChunk: ChunkCoord,
    preview: ChunkCoord[],
    chunkSize: number,
  ) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    for (const coord of preview) {
      const lx = (coord.cx - originChunk.cx) * chunkSize
      const ly = (coord.cy - originChunk.cy) * chunkSize
      ctx.fillRect(lx * cellSize, ly * cellSize, chunkSize * cellSize, chunkSize * cellSize)
    }
  }
}

export { cellSize }