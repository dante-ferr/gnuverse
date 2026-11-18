/** Screen transform for the grid. Pan and zoom stay inside the world. */
export class GridCamera {
  x = 0
  y = 0
  zoom = 1
  private fitted = false

  constructor(
    private columns: number,
    private rows: number,
  ) {}

  setWorldSize(columns: number, rows: number) {
    if (columns === this.columns && rows === this.rows) return
    this.columns = columns
    this.rows = rows
    this.fitted = false
  }

  fit(viewWidth: number, viewHeight: number, cell: number) {
    if (this.fitted || viewWidth < 1 || viewHeight < 1) return
    const worldWidth = this.columns * cell
    const worldHeight = this.rows * cell
    this.zoom = Math.min(viewWidth / worldWidth, viewHeight / worldHeight) * 0.92
    this.x = (viewWidth - worldWidth * this.zoom) / 2
    this.y = (viewHeight - worldHeight * this.zoom) / 2
    this.fitted = true
  }

  world(screenX: number, screenY: number, cell: number) {
    return {
      x: (screenX - this.x) / (cell * this.zoom),
      y: (screenY - this.y) / (cell * this.zoom),
    }
  }

  cellAt(screenX: number, screenY: number, cell: number) {
    const point = this.world(screenX, screenY, cell)
    return { x: Math.floor(point.x), y: Math.floor(point.y) }
  }

  pan(dx: number, dy: number) {
    this.x += dx
    this.y += dy
  }

  zoomAt(screenX: number, screenY: number, factor: number, cell: number) {
    const before = this.world(screenX, screenY, cell)
    this.zoom = Math.min(3, Math.max(0.35, this.zoom * factor))
    this.x = screenX - before.x * cell * this.zoom
    this.y = screenY - before.y * cell * this.zoom
  }

  /** Inclusive cell AABB visible in the viewport, with an optional cell margin. */
  visibleCellBounds(viewWidth: number, viewHeight: number, cell: number, margin = 1) {
    const topLeft = this.world(0, 0, cell)
    const bottomRight = this.world(viewWidth, viewHeight, cell)
    return {
      minX: Math.floor(topLeft.x) - margin,
      minY: Math.floor(topLeft.y) - margin,
      maxX: Math.ceil(bottomRight.x) + margin,
      maxY: Math.ceil(bottomRight.y) + margin,
    }
  }
}
