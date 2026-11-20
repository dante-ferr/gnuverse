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
import { applyPledge, quotePledge } from '../../../economy/pooled-funding.ts'

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
  match.chunkPledges = match.chunkPledges.filter((pledge) =>
    previewChunks.some((preview) => chunkKey(preview) === chunkKey(pledge)),
  )
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

export type ChunkQuote =
  | { ok: true; cost: number; paid: number; remaining: number }
  | { ok: false; status: 400 | 409; error: string }

/** Own every preview chunk whose pooled coins already meet the current price. */
export function settleFundedPledges(match: Match): void {
  let progressed = true
  while (progressed) {
    progressed = false
    const cost = nextChunkCost(match)
    const ready = match.chunkPledges.find(
      (pledge) =>
        pledge.paid >= cost &&
        match.previewChunks.some((preview) => chunkKey(preview) === chunkKey(pledge)),
    )
    if (!ready) break
    match.chunkPledges = match.chunkPledges.filter((pledge) => chunkKey(pledge) !== chunkKey(ready))
    if (buyPreviewChunk(match, ready)) break
    progressed = true
  }
}

/** Check a contribution without spending or writing. Call after `settleFundedPledges`. */
export function quoteChunkContribution(
  match: Match,
  coord: ChunkCoord,
  amount: number,
): ChunkQuote {
  const key = chunkKey(coord)
  const preview = match.previewChunks.some((item) => chunkKey(item) === key)
  const cost = nextChunkCost(match)
  const paid = match.chunkPledges.find((pledge) => chunkKey(pledge) === key)?.paid ?? 0
  const quote = quotePledge({ paid, cost, amount, eligible: preview })
  if (!quote.ok) {
    if (!preview) return { ok: false, status: 409, error: 'Esse trecho não está à venda.' }
    if (quote.status === 400 && quote.error.startsWith('Faltam ')) {
      const remaining = cost - paid
      return {
        ok: false,
        status: 400,
        error: `Esse trecho precisa de mais ${remaining} moedas.`,
      }
    }
    if (quote.status === 409 && quote.error === 'Este alvo não aceita aportes agora.') {
      return { ok: false, status: 409, error: 'Esse trecho não está à venda.' }
    }
    return quote
  }
  return quote
}

/** Add `amount` to a preview chunk. Completes ownership when the pool meets the price. */
export function applyChunkContribution(
  match: Match,
  coord: ChunkCoord,
  userId: string,
  amount: number,
): { cost: number; paid: number; completed: boolean } {
  const key = chunkKey(coord)
  const cost = nextChunkCost(match)
  const pooled = match.chunkPledges.map((pledge) => ({
    key: chunkKey(pledge),
    paid: pledge.paid,
    backers: pledge.backers.map((backer) => ({ ...backer })),
  }))
  const funded = applyPledge(pooled, key, userId, amount, cost, (pledgeKey) => ({
    key: pledgeKey,
    paid: 0,
    backers: [],
  }))
  match.chunkPledges.length = 0
  for (const pledge of pooled) {
    const sep = pledge.key.indexOf(',')
    const cx = Number(pledge.key.slice(0, sep))
    const cy = Number(pledge.key.slice(sep + 1))
    match.chunkPledges.push({
      cx,
      cy,
      paid: pledge.paid,
      backers: pledge.backers.map((backer) => ({ ...backer })),
    })
  }
  if (!funded.completed) return { cost, paid: funded.paid, completed: false }
  const paid = funded.paid
  const error = buyPreviewChunk(match, coord)
  if (error) throw new Error(error)
  return { cost, paid, completed: true }
}
