export type BlockKind = 'square' | 'wide' | 'tall'
export type Block = {
  id: string
  kind: BlockKind
  x: number
  y: number
  angle: number
  color: string
  authorId: string
}
export type WindState = {
  phase: 'pending' | 'active' | 'settling'
  endsAt: number | null
  direction: 1 | -1
}
export type Frame = {
  blocks: Block[]
  settled: boolean
  tick: number
  checkpointPending?: boolean
  cooldownRemainingMs?: number
  blocksUntilCheckpoint?: number
  wind?: WindState | null
}
export type User = { id: string; nickname: string }
export type Wallet = {
  balance: number
  cap: number
  nextCoinAt: number | null
  intervalMs: number
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
  placementCount?: number
  nextWindAt?: number
  windMinBlocks: number
  windEveryBlocks: number
  blockIntervalMs: number
  checkpointEveryBlocks: number
  blockCount: number
  coverBlocks?: Block[]
}
export type Snapshot = {
  id: string
  createdAt: number
  blocks: Block[]
  actorId: string | null
  reason: string
}
export type Member = User & {
  contributions: number
  eligible: boolean
  banned: boolean
}
export type Proposal = {
  id: string
  actorId: string
  type: 'restore' | 'ban'
  targetId: string
  reason: string
  status: string
  electorate: string[]
  votes: Record<string, string>
  createdAt: number
  closesAt: number | null
  mode: 'vote' | 'bdfl'
  rules: { quorum: number; approval: number; voteChanges: boolean }
  decisionReason?: string
  decidedBy?: string | null
  executionStatus?: string
}
export type GameEvent = {
  id: string
  type: string
  actorId: string | null
  createdAt: number
  detail: unknown
}
export type TowerState = {
  tower: Tower
  frame: Frame
  snapshots: Snapshot[]
  events: GameEvent[]
  members: Member[]
  proposals: Proposal[]
  rules: Record<string, unknown>
}
