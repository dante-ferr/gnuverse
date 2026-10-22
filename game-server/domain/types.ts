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
  windEveryBlocks: number
  windMinBlocks: number
  windStrength: number
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
  executionStatus?: 'deferred' | 'executed'
  executedAt?: number
}
export type WindState = {
  phase: 'pending' | 'active' | 'settling'
  endsAt: number | null
  direction: 1 | -1
  triggerCount: number
  strength: number
}
export type PublicFrame = Frame & {
  checkpointPending: boolean
  cooldownRemainingMs: number
  blocksUntilCheckpoint: number
  wind: Pick<WindState, 'phase' | 'endsAt' | 'direction'> | null
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
  blockIntervalMs: number
  checkpointEveryBlocks: number
  lastPlacementAt: number | null
  lastCheckpointPlacementCount: number
  pendingSnapshot: boolean
  windMinBlocks: number
  windEveryBlocks: number
  lastWindPlacementCount: number | null
  placementCount: number
  nextWindAt: number
  wind: WindState | null
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
