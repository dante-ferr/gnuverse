import type { Cell } from '../../geometry/cell.ts'
import { cellKey } from '../../geometry/cell.ts'
import type { Machine } from '../../machines/machine.ts'
import type { Match } from '../match.ts'
import {
  chunkPurchaseCost,
  previewCoords,
  visibleAabb,
  type ChunkCoord,
} from './coords.ts'
import { generatePendingPreviewChunks } from './chunk-generation.ts'

function chunkKey(coord: ChunkCoord) {
  return `${coord.cx},${coord.cy}`
}

function shiftCell(cell: Cell, dx: number, dy: number) {
  cell.x += dx
  cell.y += dy
}

function shiftMachine(machine: Machine, dx: number, dy: number) {
  // Belt, splitter, and tunnel inputs reuse the origin cell object.
  // Shift each cell once so those buildings do not jump an extra chunk.
  const seen = new Set<Cell>()
  const shiftOnce = (cell: Cell) => {
    if (seen.has(cell)) return
    seen.add(cell)
    shiftCell(cell, dx, dy)
  }
  shiftOnce(machine.origin)
  for (const slot of machine.slots) shiftOnce(slot.cell)
}

function shiftKey(key: string, dx: number, dy: number): string | null {
  const sep = key.indexOf(',')
  if (sep < 0) return null
  const x = Number(key.slice(0, sep))
  const y = Number(key.slice(sep + 1))
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null
  return cellKey({ x: x + dx, y: y + dy })
}

function shiftMergeLast(
  mergeLast: Record<string, string>,
  dx: number,
  dy: number,
): Record<string, string> {
  if (dx === 0 && dy === 0) return { ...mergeLast }
  const next: Record<string, string> = {}
  for (const [dest, inbound] of Object.entries(mergeLast)) {
    const destKey = shiftKey(dest, dx, dy)
    const inboundKey = shiftKey(inbound, dx, dy)
    if (destKey && inboundKey) next[destKey] = inboundKey
  }
  return next
}

function shiftPullLast(
  pullLast: Record<string, 'pull' | 'flow'>,
  dx: number,
  dy: number,
): Record<string, 'pull' | 'flow'> {
  if (dx === 0 && dy === 0) return { ...pullLast }
  const next: Record<string, 'pull' | 'flow'> = {}
  for (const [from, choice] of Object.entries(pullLast)) {
    const fromKey = shiftKey(from, dx, dy)
    if (fromKey) next[fromKey] = choice
  }
  return next
}

/** Apply an owned-set change: recompute preview AABB and remap local cells if the origin moves. */
export function applyOwnedChunks(match: Match, ownedChunks: ChunkCoord[]): void {
  const chunkSize = match.rules.chunkSize
  const previewChunks = previewCoords(ownedChunks, match.rules.mapChunkExtent)
  const { originChunk, width, height } = visibleAabb(
    [...ownedChunks, ...previewChunks],
    chunkSize,
  )
  const dx = (match.originChunk.cx - originChunk.cx) * chunkSize
  const dy = (match.originChunk.cy - originChunk.cy) * chunkSize

  if (dx !== 0 || dy !== 0) {
    for (const core of match.cores) shiftMachine(core, dx, dy)
    for (const source of match.sources) shiftMachine(source, dx, dy)
    for (const belt of match.belts) shiftMachine(belt, dx, dy)
    for (const combiner of match.combiners) shiftMachine(combiner, dx, dy)
    for (const splitter of match.splitters) shiftMachine(splitter, dx, dy)
    for (const tunnel of match.tunnels) shiftMachine(tunnel, dx, dy)
    for (const packet of match.packets) shiftCell(packet.cell, dx, dy)
    match.mergeLast = shiftMergeLast(match.mergeLast, dx, dy)
    match.pullLast = shiftPullLast(match.pullLast, dx, dy)
  }

  match.originChunk = originChunk
  match.width = width
  match.height = height
  match.ownedChunks.length = 0
  match.ownedChunks.push(...ownedChunks.map((coord) => ({ ...coord })))
  match.previewChunks.length = 0
  match.previewChunks.push(...previewChunks.map((coord) => ({ ...coord })))
  match.rebuildChunkKeys()
  generatePendingPreviewChunks(match)
}

/** Buy a preview chunk. Returns an error message, or null on success. */
export function buyPreviewChunk(match: Match, coord: ChunkCoord): string | null {
  const key = chunkKey(coord)
  if (!match.previewChunks.some((item) => chunkKey(item) === key))
    return 'Esse trecho não está à venda.'
  if (match.ownedChunks.some((item) => chunkKey(item) === key))
    return 'Esse trecho já é jogável.'
  applyOwnedChunks(match, [...match.ownedChunks, { cx: coord.cx, cy: coord.cy }])
  return null
}

export function nextChunkCost(match: Match): number {
  return chunkPurchaseCost(
    match.ownedChunks.length,
    match.rules.chunkCostBase,
    match.rules.chunkCostStep,
  )
}
