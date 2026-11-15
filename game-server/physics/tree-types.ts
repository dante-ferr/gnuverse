export type TreeNode = {
  id: string
  x: number
  y: number
  parentId: string | null
  authorId: string
  authorName: string
  leaf: boolean
  fortified: boolean
  secondaryRoot: boolean
  broken?: boolean
}

export type FireflyState = {
  path: { x: number; y: number }[]
  index: number
  active: boolean
  phasesSeen: number
}

export type FlowerState = {
  bloomed: boolean
  nodeId: string | null
  energyPhasesAboveZero: number
}

export type TurnPhase = 'idle' | 'actionWindow' | 'physics'

export type TreeOutcome = 'playing' | 'won' | 'lost'

export type TreeFrame = {
  nodes: TreeNode[]
  energy: number
  turn: {
    phase: TurnPhase
    phaseEndsAt: number | null
    physicsTick: number
  }
  firefly: FireflyState
  flower: FlowerState
  outcome: TreeOutcome
  exit: { x: number; y: number; width: number; height: number }
  tick: number
  simulating: boolean
}

export type GrowInput = {
  parentId: string
  x: number
  y: number
  authorId: string
  authorName: string
}

export type TreeActionResult =
  | { ok: true; nodeId?: string; error?: never }
  | { ok: false; error: string }