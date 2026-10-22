import type { Frame } from '../physics/index.ts'

export type Rules = {
  cap: number
  initialBalance: number
  intervalMs: number
  cooldownMs: number
  defaultCost: number
  proposalDurationMs: number
  quorum: number
  approval: number
  maxCost: number
  minContributions: number
  maxBlocks: number
  maxTowers: number
  tokenLifetimeMs: number
  banDurationMs: number
  voteChanges: boolean
  bdflVeto: boolean
  prototype: boolean
}
export type User = {
  id: string
  nickname: string
  email: string
  salt: string
  password: string
  balance: number
  coinAt: number
  lastAction: number | null
}
export type Member = {
  id: string
  nickname: string
  contributions: number
  eligible: boolean
  banned: boolean
  bannedUntil?: number
}
export type TowerEvent = {
  id: string
  type: string
  actorId: string | null
  detail: unknown
  createdAt: number
}
export type Snapshot = {
  id: string
  createdAt: number
  blocks: Frame['blocks']
  actorId: string | null
  reason: string
}
export type Proposal = {
  id: string
  type: 'ban' | 'restore'
  targetId: string
  reason: string
  actorId: string
  status: 'pending' | 'accepted' | 'rejected'
  mode: 'vote' | 'bdfl'
  createdAt: number
  closesAt: number | null
  electorate: string[]
  votes: Record<string, 'for' | 'against' | 'abstain'>
  rules: { quorum: number; approval: number; voteChanges: boolean }
  decisionReason?: string
  decidedAt?: number
  decidedBy?: string | null
}
export type Tower = {
  id: string
  name: string
  creatorId: string
  allowCreatorBan: boolean
  cost: number
  banMode: 'vote' | 'bdfl'
  restoreMode: 'vote' | 'bdfl'
  eligibilityMode: 'automatic' | 'manual'
  minContributions: number
  members: Record<string, Member>
  snapshots: Snapshot[]
  events: TowerEvent[]
  proposals: Proposal[]
  pendingSnapshot: boolean
  frame: Frame
  lastActorId?: string
}
export type State = {
  users: Record<string, User>
  sessions: Record<string, { userId: string; expiresAt: number }>
  towers: Record<string, Tower>
}
export type ServerOptions = {
  dbPath?: string
  now?: () => number
  allowedOrigins?: string[]
  rules?: Partial<Rules>
}
