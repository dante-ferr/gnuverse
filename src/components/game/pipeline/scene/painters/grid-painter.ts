import type { ChunkCoord } from '../../../../../../game-server/pipeline/world/chunks/coords.ts'
import type { PipelineFrame, PipelineRules } from '../../model/frame.ts'
import { darkenHex } from './darken-hex.ts'

const cellSize = 48
/** Avoid allocating multi-megapixel floor bitmaps on phones (starter AABB is 96×96 cells). */
const MAX_FLOOR_CACHE_SIDE_PX = 2048

export type CellBounds = { minX: number; minY: number; maxX: number; maxY: number }

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

function chunkKey(coord: ChunkCoord): string {
  return `${coord.cx},${coord.cy}`
}

function chunkVisible(
  origin: ChunkCoord,
  coord: ChunkCoord,
  chunkSize: number,
  bounds: CellBounds | undefined,
) {
  if (!bounds) return true
  const lx = (coord.cx - origin.cx) * chunkSize
  const ly = (coord.cy - origin.cy) * chunkSize
  return lx <= bounds.maxX && lx + chunkSize >= bounds.minX && ly <= bounds.maxY && ly + chunkSize >= bounds.minY
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

  draw(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    rules: PipelineRules,
    zoom: number,
    bounds?: CellBounds,
  ) {
    const worldW = frame.width * cellSize
    const worldH = frame.height * cellSize
    const showGrid = zoom >= rules.gridVisibleMinZoom
    if (worldW > MAX_FLOOR_CACHE_SIDE_PX || worldH > MAX_FLOOR_CACHE_SIDE_PX) {
      this.paintFloor(ctx, frame, rules, showGrid, bounds)
      return
    }
    const cache = this.ensureFloorCache(frame, rules)
    if (bounds) {
      const x0 = Math.max(0, bounds.minX) * cellSize
      const y0 = Math.max(0, bounds.minY) * cellSize
      const x1 = Math.min(frame.width, bounds.maxX + 1) * cellSize
      const y1 = Math.min(frame.height, bounds.maxY + 1) * cellSize
      const w = x1 - x0
      const h = y1 - y0
      if (w > 0 && h > 0) ctx.drawImage(cache, x0, y0, w, h, x0, y0, w, h)
    } else {
      ctx.drawImage(cache, 0, 0)
    }
    if (showGrid) this.paintCellGrid(ctx, frame, rules, bounds)
  }

  drawPreviewOverlay(ctx: CanvasRenderingContext2D, frame: PipelineFrame, rules: PipelineRules) {
    const { originChunk, preview, chunkSize } = frameChunks(frame, rules)
    this.fillPreviewOverlay(ctx, originChunk, preview, chunkSize)
  }

  /** Soft fills for placement range hints (e.g. valid tunnel exits). */
  drawHintCells(
    ctx: CanvasRenderingContext2D,
    cells: { x: number; y: number }[],
    frame: PipelineFrame,
    fill: string,
    alpha = 0.2,
  ) {
    if (cells.length === 0) return
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = fill
    for (const cell of cells) {
      if (cell.x < 0 || cell.y < 0 || cell.x >= frame.width || cell.y >= frame.height) continue
      ctx.fillRect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize)
    }
    ctx.restore()
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
    bounds?: CellBounds,
  ) {
    const { originChunk, owned, preview, chunkSize } = frameChunks(frame, rules)
    const voidFill = darkenHex(rules.colorBackground, 22)
    const worldW = frame.width * cellSize
    const worldH = frame.height * cellSize

    ctx.fillStyle = voidFill
    if (bounds) {
      ctx.fillRect(
        bounds.minX * cellSize,
        bounds.minY * cellSize,
        (bounds.maxX - bounds.minX + 1) * cellSize,
        (bounds.maxY - bounds.minY + 1) * cellSize,
      )
    } else {
      ctx.fillRect(0, 0, worldW, worldH)
    }

    const playable = [...owned, ...preview].filter((coord) =>
      chunkVisible(originChunk, coord, chunkSize, bounds),
    )
    ctx.fillStyle = rules.colorBackground
    for (const coord of playable) {
      const lx = (coord.cx - originChunk.cx) * chunkSize
      const ly = (coord.cy - originChunk.cy) * chunkSize
      ctx.fillRect(lx * cellSize, ly * cellSize, chunkSize * cellSize, chunkSize * cellSize)
    }

    if (showGrid) this.paintCellGrid(ctx, frame, rules, bounds)
    this.drawChunkBorders(ctx, originChunk, owned, preview, chunkSize, rules, bounds)
  }

  private paintCellGrid(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    rules: PipelineRules,
    bounds?: CellBounds,
  ) {
    const { originChunk, owned, preview, chunkSize } = frameChunks(frame, rules)
    const playable = [...owned, ...preview].filter((coord) =>
      chunkVisible(originChunk, coord, chunkSize, bounds),
    )
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
    bounds?: CellBounds,
  ) {
    const ownedKeys = new Set(owned.map(chunkKey))
    ctx.strokeStyle = rules.colorMuted
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    for (const coord of owned) {
      if (!chunkVisible(originChunk, coord, chunkSize, bounds)) continue
      this.appendOwnedChunkBorderEdges(ctx, originChunk, coord, chunkSize, ownedKeys)
    }
    for (const coord of preview) {
      if (!chunkVisible(originChunk, coord, chunkSize, bounds)) continue
      const lx = (coord.cx - originChunk.cx) * chunkSize
      const ly = (coord.cy - originChunk.cy) * chunkSize
      const x0 = lx * cellSize + 0.5
      const y0 = ly * cellSize + 0.5
      const extent = chunkSize * cellSize
      ctx.rect(x0, y0, extent, extent)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  /** Chunk outline on edges that do not touch another owned chunk (no seam between unlocks). */
  private appendOwnedChunkBorderEdges(
    ctx: CanvasRenderingContext2D,
    originChunk: ChunkCoord,
    coord: ChunkCoord,
    chunkSize: number,
    ownedKeys: Set<string>,
  ) {
    const neighborOwned = (dx: number, dy: number) => ownedKeys.has(chunkKey({ cx: coord.cx + dx, cy: coord.cy + dy }))
    const lx = (coord.cx - originChunk.cx) * chunkSize
    const ly = (coord.cy - originChunk.cy) * chunkSize
    const x0 = lx * cellSize + 0.5
    const y0 = ly * cellSize + 0.5
    const x1 = x0 + chunkSize * cellSize
    const y1 = y0 + chunkSize * cellSize
    if (!neighborOwned(0, -1)) {
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y0)
    }
    if (!neighborOwned(1, 0)) {
      ctx.moveTo(x1, y0)
      ctx.lineTo(x1, y1)
    }
    if (!neighborOwned(0, 1)) {
      ctx.moveTo(x1, y1)
      ctx.lineTo(x0, y1)
    }
    if (!neighborOwned(-1, 0)) {
      ctx.moveTo(x0, y1)
      ctx.lineTo(x0, y0)
    }
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
