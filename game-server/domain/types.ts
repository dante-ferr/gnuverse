import type { TreeFrame } from '../physics/tree-types.ts'
import type { TreeRules } from '../config/load-game-config.ts'
import type { PipelineFrame } from '../pipeline/world/frame.ts'
import type { PipelineRules } from '../pipeline/rules.ts'
import type { Role } from '../../core/authz/policy.ts'
import type { Identity } from '../../core/authz/identity.ts'
import type { IdentityProvider } from '../../core/authn/identity-provider.ts'

export type Rules = {
  cap: number
  initialBalance: number
  intervalMs: number
  cooldownMs: number
  defaultCost: number
  maxCost: number
  minContributions: number
  maxSegments: number
  maxTowers: number
  tokenLifetimeMs: number
  banDurationMs: number
  bdflVeto: boolean
  prototype: boolean
  infiniteCoins: boolean
  tree: TreeRules
  pipeline: PipelineRules
}
export type User = {
  roles?: readonly Role[]
  id: string
  nickname: string
  email: string
  identity?: Identity
  salt?: string
  password?: string
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
  tree: PipelineFrame
  actorId: string | null
  reason: string
}
export type Proposal = {
  id: string
  type: 'ban'
  targetId: string
  reason: string
  actorId: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: number
  decisionReason?: string
  decidedAt?: number
  decidedBy?: string | null
  executionStatus?: 'executed'
  executedAt?: number
}
export type PublicTreeFrame = TreeFrame & { phaseRemainingMs: number; fireflyPosition: { x: number; y: number } | null }
export type Tower = {
  id: string
  name: string
  creatorId: string
  allowCreatorBan: boolean
  cost: number
  eligibilityMode: 'automatic' | 'manual'
  minContributions: number
  members: Record<string, Member>
  snapshots: Snapshot[]
  events: TowerEvent[]
  proposals: Proposal[]
  segmentCount: number
  frame: PipelineFrame
  lastActorId?: string
  actionCount: number
}
export type State = {
  users: Record<string, User>
  sessions: Record<string, { userId: string; expiresAt: number }>
  towers: Record<string, Tower>
}
export type ServerOptions = {
  identityProvider?: IdentityProvider
  dbPath?: string
  now?: () => number
  allowedOrigins?: string[]
  rules?: Partial<Omit<Rules, 'pipeline'>> & { pipeline?: Partial<PipelineRules> }
}