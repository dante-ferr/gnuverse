import type { ChunkCoord } from '../../../../../../game-server/pipeline/world/chunks/coords.ts'
import type { PipelineFrame, PipelineRules } from '../../model/frame.ts'
import { darkenHex } from './darken-hex.ts'

const cellSize = 48
/** Avoid allocating multi-megapixel floor bitmaps on phones (starter AABB is 96×96 cells). */
const MAX_FLOOR_CACHE_SIDE_PX = 2048

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

function floorCacheKey(frame: PipelineFrame, rules: PipelineRules) {
  const { originChunk, owned, preview, chunkSize } = frameChunks(frame, rules)
  const ownedKeys = owned.map((c) => `${c.cx},${c.cy}`).join(';')
  const previewKeys = preview.map((c) => `${c.cx},${c.cy}`).join(';')
  return [
    frame.width,
    frame.height,
    chunkSize,
    originChunk.cx,
    originChunk.cy,
    ownedKeys,
    previewKeys,
    rules.colorBackground,
    rules.colorGrid,
    rules.colorMuted,
  ].join('|')
}

/** Draws the floor grid with owned, preview, and void regions. */
export class GridPainter {
  private floorCache: HTMLCanvasElement | null = null
  private floorCacheKey = ''

  draw(ctx: CanvasRenderingContext2D, frame: PipelineFrame, rules: PipelineRules, zoom: number) {
    const worldW = frame.width * cellSize
    const worldH = frame.height * cellSize
    const showGrid = zoom >= rules.gridVisibleMinZoom
    if (worldW > MAX_FLOOR_CACHE_SIDE_PX || worldH > MAX_FLOOR_CACHE_SIDE_PX) {
      this.paintFloor(ctx, frame, rules, showGrid)
      return
    }
    const cache = this.ensureFloorCache(frame, rules)
    ctx.drawImage(cache, 0, 0)
    if (showGrid) this.paintCellGrid(ctx, frame, rules)
  }

  drawPreviewOverlay(ctx: CanvasRenderingContext2D, frame: PipelineFrame, rules: PipelineRules) {
    const { originChunk, preview, chunkSize } = frameChunks(frame, rules)
    this.fillPreviewOverlay(ctx, originChunk, preview, chunkSize)
  }

  private ensureFloorCache(frame: PipelineFrame, rules: PipelineRules) {
    const key = floorCacheKey(frame, rules)
    if (this.floorCache && this.floorCacheKey === key) return this.floorCache
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, frame.width * cellSize)
    canvas.height = Math.max(1, frame.height * cellSize)
    const off = canvas.getContext('2d')
    if (!off) return canvas
    this.paintFloor(off, frame, rules, false)
    this.floorCache = canvas
    this.floorCacheKey = key
    return canvas
  }

  private paintFloor(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    rules: PipelineRules,
    showGrid: boolean,
  ) {
    const { originChunk, owned, preview, chunkSize } = frameChunks(frame, rules)
    const voidFill = darkenHex(rules.colorBackground, 22)
    const worldW = frame.width * cellSize
    const worldH = frame.height * cellSize

    ctx.fillStyle = voidFill
    ctx.fillRect(0, 0, worldW, worldH)

    const playable = [...owned, ...preview]
    ctx.fillStyle = rules.colorBackground
    for (const coord of playable) {
      const lx = (coord.cx - originChunk.cx) * chunkSize
      const ly = (coord.cy - originChunk.cy) * chunkSize
      ctx.fillRect(lx * cellSize, ly * cellSize, chunkSize * cellSize, chunkSize * cellSize)
    }

    if (showGrid) this.paintCellGrid(ctx, frame, rules)
    this.drawChunkBorders(ctx, originChunk, owned, preview, chunkSize, rules)
  }

  private paintCellGrid(ctx: CanvasRenderingContext2D, frame: PipelineFrame, rules: PipelineRules) {
    const { originChunk, owned, preview, chunkSize } = frameChunks(frame, rules)
    const playable = [...owned, ...preview]
    ctx.strokeStyle = rules.colorGrid
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const coord of playable) {
      const lx = (coord.cx - originChunk.cx) * chunkSize
      const ly = (coord.cy - originChunk.cy) * chunkSize
      const px = lx * cellSize + 0.5
      const py = ly * cellSize + 0.5
      const extent = chunkSize * cellSize
      for (let i = 0; i <= chunkSize; i++) {
        const offset = i * cellSize
        ctx.moveTo(px, py + offset)
        ctx.lineTo(px + extent, py + offset)
        ctx.moveTo(px + offset, py)
        ctx.lineTo(px + offset, py + extent)
      }
    }
    ctx.stroke()
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
