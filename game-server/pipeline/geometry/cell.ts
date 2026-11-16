export type Cell = { x: number; y: number }

export function cellKey(cell: Cell) {
  return `${cell.x},${cell.y}`
}

export function sameCell(a: Cell, b: Cell) {
  return a.x === b.x && a.y === b.y
}
