export type TreeNode = {
  id: string
  x: number
  y: number
  parentId: string | null
  authorId: string
  authorName: string
  leaf: boolean
  fortified: boolean
  secondaryRoot?: boolean
  broken?: boolean
  attach?: { x: number; y: number }
}
export type TreeFrame = {
  nodes: TreeNode[]
  energy: number
  turn: { phase: 'idle' | 'actionWindow' | 'physics'; phaseEndsAt: number | null }
  firefly: {
    path: { x: number; y: number }[]
    index: number
    active: boolean
    phasesSeen: number
  }
  flower: { bloomed: boolean; nodeId: string | null; energyPhasesAboveZero: number }
  outcome: 'playing' | 'won' | 'lost'
  exit: { x: number; y: number; width: number; height: number }
  tick: number
  simulating?: boolean
  phaseRemainingMs?: number
  fireflyPosition?: { x: number; y: number } | null
  treeSeed?: string
}
export type User = { id: string; nickname: string; roles?: readonly import('../../../../core/authz/policy').Role[] }
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
  eligibilityMode: 'automatic' | 'manual'
  minContributions: number
  segmentCount: number
  actionCount?: number
  outcome?: 'playing' | 'won' | 'lost'
  coverNodes?: TreeNode[]
}
export type Snapshot = {
  id: string
  createdAt: number
  tree: TreeFrame
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
  type: 'ban'
  targetId: string
  reason: string
  status: string
  createdAt: number
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
  frame: TreeFrame
  snapshots: Snapshot[]
  events: GameEvent[]
  members: Member[]
  proposals: Proposal[]
  rules: Record<string, unknown>
}