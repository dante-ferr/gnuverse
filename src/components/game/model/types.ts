export type User = { id: string; nickname: string; roles?: readonly import('../../../../core/authz/policy').Role[] }
export type Wallet = {
  balance: number
  /** Passive-income cap shown in the HUD. */
  cap: number
  /** Absolute balance maximum. */
  absoluteCap?: number
  nextCoinAt: number | null
  intervalMs: number
}
export type Room = {
  id: string
  name: string
  creatorId: string
  allowCreatorBan: boolean
  cost: number
  eligibilityMode: 'automatic' | 'manual'
  minContributions: number
  beltCount: number
  /** Lifetime craft deliveries (Pontuação). */
  deliveries?: number
  actionCount?: number
  outcome?: 'playing' | 'won' | 'lost'
}
export type Member = User & {
  contributions: number
  eligible: boolean
  banned: boolean
}
export type Proposal = {
  id: string
  actorId: string
  type: 'ban'
  targetId: string
  reason: string
  status: string
  createdAt: number
  decisionReason?: string
  decidedBy?: string | null
  executionStatus?: string
}
export type ChatMessage = {
  id: string
  authorId: string
  authorNickname: string
  text: string
  createdAt: number
}
export type GameEvent = {
  id: string
  type: string
  actorId: string | null
  createdAt: number
  detail: unknown
}