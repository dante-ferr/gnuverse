import type { Match } from '../match.ts'
import { chunkKey, type ChunkCoord } from './coords.ts'
import { applyPledge, quotePledge, type PooledPledge } from '../../../economy/pooled-funding.ts'
import { placeCoreInChunk } from './chunk-generation.ts'

function corePledges(match: Match): PooledPledge[] {
  return match.corePledges.map((pledge) => ({
    key: chunkKey(pledge),
    paid: pledge.paid,
    backers: pledge.backers.map((backer) => ({ ...backer })),
  }))
}

function syncCorePledges(match: Match, pooled: PooledPledge[]): void {
  match.corePledges.length = 0
  for (const pledge of pooled) {
    const sep = pledge.key.indexOf(',')
    const cx = Number(pledge.key.slice(0, sep))
    const cy = Number(pledge.key.slice(sep + 1))
    if (!Number.isInteger(cx) || !Number.isInteger(cy)) continue
    match.corePledges.push({
      cx,
      cy,
      paid: pledge.paid,
      backers: pledge.backers.map((backer) => ({ ...backer })),
    })
  }
}

function coordFromKey(key: string): ChunkCoord {
  const sep = key.indexOf(',')
  return {
    cx: Number(key.slice(0, sep)),
    cy: Number(key.slice(sep + 1)),
  }
}

function isCorePurchaseTarget(match: Match, coord: ChunkCoord): boolean {
  const key = chunkKey(coord)
  if (!match.optionalCoreChunkKeys.has(key)) return false
  return match.ownedChunks.some((item) => chunkKey(item) === key)
}

/** Complete pools that already meet the fixed core price on owned optional chunks. */
export function settleFundedCorePledges(match: Match): void {
  const cost = match.rules.optionalCoreCost
  const pledges = corePledges(match)
  let progressed = true
  while (progressed) {
    progressed = false
    const ready = pledges.find(
      (pledge) => pledge.paid >= cost && isCorePurchaseTarget(match, coordFromKey(pledge.key)),
    )
    if (!ready) break
    const index = pledges.findIndex((item) => item.key === ready.key)
    if (index >= 0) pledges.splice(index, 1)
    const error = completeOptionalCore(match, coordFromKey(ready.key))
    if (error) break
    progressed = true
  }
  syncCorePledges(match, pledges)
}

export type CoreQuote =
  | { ok: true; cost: number; paid: number; remaining: number }
  | { ok: false; status: 400 | 409; error: string }

export function quoteCoreContribution(
  match: Match,
  coord: ChunkCoord,
  amount: number,
): CoreQuote {
  const key = chunkKey(coord)
  const eligible = isCorePurchaseTarget(match, coord)
  const quote = quotePledge({
    paid: match.corePledges.find((item) => chunkKey(item) === key)?.paid ?? 0,
    cost: match.rules.optionalCoreCost,
    amount,
    eligible,
  })
  if (!quote.ok) {
    if (!eligible) {
      if (!match.optionalCoreChunkKeys.has(key)) {
        return { ok: false, status: 409, error: 'Este trecho não reserva um núcleo opcional.' }
      }
      return { ok: false, status: 409, error: 'Compre o trecho antes de financiar o núcleo.' }
    }
    return quote
  }
  return quote
}

export function applyCoreContribution(
  match: Match,
  coord: ChunkCoord,
  userId: string,
  amount: number,
): { cost: number; paid: number; completed: boolean } {
  const key = chunkKey(coord)
  const cost = match.rules.optionalCoreCost
  const pledges = corePledges(match)
  const funded = applyPledge(pledges, key, userId, amount, cost, (pledgeKey) => ({
    key: pledgeKey,
    paid: 0,
    backers: [],
  }))
  syncCorePledges(match, pledges)
  if (!funded.completed) return { cost, paid: funded.paid, completed: false }
  const error = completeOptionalCore(match, coord)
  if (error) throw new Error(error)
  return { cost, paid: funded.paid, completed: true }
}

function completeOptionalCore(match: Match, coord: ChunkCoord): string | null {
  const key = chunkKey(coord)
  if (!match.optionalCoreChunkKeys.has(key)) return 'Este trecho não reserva um núcleo opcional.'
  if (!match.ownedChunks.some((item) => chunkKey(item) === key)) {
    return 'Compre o trecho antes de financiar o núcleo.'
  }
  placeCoreInChunk(match, coord)
  match.optionalCoreChunkKeys.delete(key)
  match.corePledges = match.corePledges.filter((item) => chunkKey(item) !== key)
  return null
}