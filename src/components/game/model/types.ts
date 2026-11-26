export type User = { id: string; nickname: string; roles?: readonly import('../../../../core/authz/policy').Role[] }
export type Wallet = {
  /** Passive-income coins; fills toward `cap`. */
  balance: number
  /** Reward coins from reading and quizzes (no cap; spent after `balance`). */
  rewardBalance?: number
  /** Everything spendable: `balance + rewardBalance`. */
  spendable?: number
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
  /** Contributor majority restores checkpoints without the owner. */
  restoreByMajority?: boolean
  /** Contributor majority suspends members (never the owner). */
  banByMajority?: boolean
  /** Coins spent since the last checkpoint. */
  checkpointSpend?: number
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
  type: 'ban' | 'restore'
  /** Ban: member id. Restore: checkpoint id. */
  targetId: string
  reason: string
  status: string
  createdAt: number
  decisionReason?: string
  decidedBy?: string | null
  decidedByMajority?: boolean
  executionStatus?: string
  supporters?: string[]
  /** True when contributor majority (not the owner) accepts this proposal. */
  byMajority?: boolean
  tally?: { supporters: number; voters: number; needed: number }
}
export type Checkpoint = {
  id: string
  createdAt: number
  actorId: string | null
  reason: string
  kind: 'created' | 'spend' | 'pre-restore'
  tick: number
  deliveries: number
  version: string
  belts: number
  chunks: number
}
export type RoomGovernance = {
  restoreByMajority: boolean
  banByMajority: boolean
  checkpointSpend: number
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