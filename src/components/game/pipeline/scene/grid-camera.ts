/** Screen transform for the grid. Pan and zoom stay inside the world. */
export type CameraZoomLimits = { min: number; max: number }

export class GridCamera {
  x = 0
  y = 0
  zoom = 1
  private fitted = false
  private zoomMin = 0.08
  private zoomMax = 3

  constructor(
    private columns: number,
    private rows: number,
  ) {}

  setZoomLimits(limits: CameraZoomLimits) {
    this.zoomMin = limits.min
    this.zoomMax = limits.max
    this.zoom = Math.min(this.zoomMax, Math.max(this.zoomMin, this.zoom))
  }

  setWorldSize(columns: number, rows: number, options?: { keepView?: boolean }) {
    if (columns === this.columns && rows === this.rows) return
    this.columns = columns
    this.rows = rows
    if (!options?.keepView) this.fitted = false
  }

  resetView() {
    this.fitted = false
  }

  /** True after the first successful enter/fit for the current view. */
  get hasView() {
    return this.fitted
  }

  /** Shift the camera so remapped local cells stay under the same screen point. */
  compensateOriginShift(dxCells: number, dyCells: number, cell: number) {
    this.x -= dxCells * cell * this.zoom
    this.y -= dyCells * cell * this.zoom
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

  applyInitialView(viewWidth: number, viewHeight: number, cell: number, apply: () => void) {
    if (this.fitted || viewWidth < 1 || viewHeight < 1) return
    apply()
    this.fitted = true
  }

  centerOn(
    cellX: number,
    cellY: number,
    viewWidth: number,
    viewHeight: number,
    cell: number,
  ) {
    this.x = viewWidth / 2 - cellX * cell * this.zoom
    this.y = viewHeight / 2 - cellY * cell * this.zoom
  }

  setZoomToFitCells(
    spanCells: number,
    viewWidth: number,
    viewHeight: number,
    cell: number,
  ) {
    if (spanCells < 1) return
    const span = spanCells * cell
    this.zoom = Math.min(viewWidth, viewHeight) / span
    this.zoom = Math.min(this.zoomMax, Math.max(this.zoomMin, this.zoom))
  }

  worldCenter(viewWidth: number, viewHeight: number, cell: number) {
    return this.world(viewWidth / 2, viewHeight / 2, cell)
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
    this.zoom = Math.min(this.zoomMax, Math.max(this.zoomMin, this.zoom * factor))
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