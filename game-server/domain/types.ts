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
  defaultCost: number
  maxCost: number
  minContributions: number
  maxBelts: number
  maxRooms: number
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
export type Snapshot = {
  id: string
  createdAt: number
  frame: PipelineFrame
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
export type Room = {
  id: string
  name: string
  creatorId: string
  allowCreatorBan: boolean
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
  now?: () => number
  allowedOrigins?: string[]
  rules?: Partial<Omit<Rules, 'pipeline'>> & { pipeline?: Partial<PipelineRules> }
}