/** Collects unique grid cells visited while erasing belts. */
export class BeltEraseStroke {
  readonly cells: { x: number; y: number }[] = []
  private readonly seen = new Set<string>()

  push(cell: { x: number; y: number }): boolean {
    const key = `${cell.x},${cell.y}`
    if (this.seen.has(key)) return false
    this.seen.add(key)
    this.cells.push(cell)
    return true
  }
}