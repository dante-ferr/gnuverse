import type { PipelineRules } from '../pipeline/rules.ts'
import type { PipelineFrame } from '../pipeline/world/frame.ts'
import type { Role } from '../../core/authz/policy.ts'
import type { Identity } from '../../core/authz/identity.ts'
import type { IdentityProvider } from '../../core/authn/identity-provider.ts'

export type Rules = {
  cap: number
  initialBalance: number
  intervalMs: number
  cooldownMs: number
  minContributions: number
  maxBelts: number
  maxRooms: number
  maxRoomsPerCreator: number
  tokenLifetimeMs: number
  banDurationMs: number
  chatMessageMaxLength: number
  chatHistoryLimit: number
  chatCooldownMs: number
  bdflVeto: boolean
  prototype: boolean
  infiniteCoins: boolean
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
  /** Reward coins (blog and quizzes): separate from passive income and not capped by it. */
  rewardBalance?: number
  /** Reward claims already paid, keyed by `article:<slug>`, `quiz:<slug>:<question>` or `quiz:<slug>:perfect`. */
  rewardClaims?: Record<string, number>
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
  lastChatAt?: number
}
export type ChatMessage = {
  id: string
  authorId: string
  authorNickname: string
  text: string
  createdAt: number
}
export type RoomEvent = {
  id: string
  type: string
  actorId: string | null
  detail: unknown
  createdAt: number
}
/**
 * Restore point of a room's factory. `created` is the room-creation snapshot,
 * `spend` is saved each time `checkpointSpendCoins` is spent in the room, and
 * `pre-restore` keeps the factory as it was just before a restore.
 */
export type SnapshotKind = 'created' | 'spend' | 'pre-restore'
export type Snapshot = {
  id: string
  createdAt: number
  frame: PipelineFrame
  actorId: string | null
  reason: string
  kind?: SnapshotKind
}
export type ProposalType = 'ban' | 'restore'
export type Proposal = {
  id: string
  type: ProposalType
  /** Ban: member to suspend. Restore: checkpoint (snapshot) id. */
  targetId: string
  reason: string
  actorId: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: number
  /** Contributors who agreed (the proposer agrees on creation). */
  supporters?: string[]
  /** How the proposal closed: room owner decision or contributor majority. */
  decidedByMajority?: boolean
  decisionReason?: string
  decidedAt?: number
  decidedBy?: string | null
  executionStatus?: 'executed'
  executedAt?: number
}
export type Room = {
  id: string
  name: string
  creatorId: string
  allowCreatorBan: boolean
  /** Contributor majority restores checkpoints without the owner. Off by default. */
  restoreByMajority?: boolean
  /** Contributor majority suspends members (never the owner). Off by default. */
  banByMajority?: boolean
  /** Coins spent since the last checkpoint. */
  checkpointSpend?: number
  cost: number
  eligibilityMode: 'automatic' | 'manual'
  minContributions: number
  members: Record<string, Member>
  chat: ChatMessage[]
  snapshots: Snapshot[]
  events: RoomEvent[]
  proposals: Proposal[]
  beltCount: number
  frame: PipelineFrame
  lastActorId?: string
  actionCount: number
}
export type State = {
  users: Record<string, User>
  sessions: Record<string, { userId: string; expiresAt: number }>
  rooms: Record<string, Room>
}
export type ServerOptions = {
  identityProvider?: IdentityProvider
  dbPath?: string
  store?: import('../persistence/game-store.ts').GameStore
  contentCatalog?: import('../economy/content-catalog.ts').ContentCatalog
  now?: () => number
  allowedOrigins?: string[]
  rules?: Partial<Omit<Rules, 'pipeline'>> & { pipeline?: Partial<PipelineRules> }
}