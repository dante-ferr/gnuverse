import type { Match } from '../pipeline/world/match.ts'

/** Lifetime room spend for ranking (charges only; refunds do not reduce). */
export function recordRoomSpend(match: Match, userId: string, amount: number): void {
  if (!Number.isInteger(amount) || amount < 1) return
  match.spentByUserId[userId] = (match.spentByUserId[userId] ?? 0) + amount
}