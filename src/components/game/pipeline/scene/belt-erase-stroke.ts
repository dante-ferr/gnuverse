/** Axis-aligned erase area from a pointer drag (origin → current cell). */
export class BeltEraseStroke {
  private origin: { x: number; y: number } | null = null
  private end: { x: number; y: number } | null = null

  /** Returns true when the erase rectangle changes. */
  push(cell: { x: number; y: number }): boolean {
    if (!this.origin) {
      this.origin = { x: cell.x, y: cell.y }
      this.end = { x: cell.x, y: cell.y }
      return true
    }
    if (this.end && this.end.x === cell.x && this.end.y === cell.y) return false
    this.end = { x: cell.x, y: cell.y }
    return true
  }

  /** Inclusive rectangle corners, or null before the first cell. */
  bounds(): { minX: number; maxX: number; minY: number; maxY: number } | null {
    if (!this.origin || !this.end) return null
    return {
      minX: Math.min(this.origin.x, this.end.x),
      maxX: Math.max(this.origin.x, this.end.x),
      minY: Math.min(this.origin.y, this.end.y),
      maxY: Math.max(this.origin.y, this.end.y),
    }
  }

  /** Every grid cell inside the erase rectangle. */
  cells(): { x: number; y: number }[] {
    const box = this.bounds()
    if (!box) return []
    const cells: { x: number; y: number }[] = []
    for (let y = box.minY; y <= box.maxY; y++) {
      for (let x = box.minX; x <= box.maxX; x++) {
        cells.push({ x, y })
      }
    }
    return cells
  }
}
