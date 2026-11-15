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
  /** Ponto de ligação ao longo do segmento pai (crescimento a partir da haste). */
  attach?: { x: number; y: number }
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
  /** Semente estável do terreno (id da árvore/sala). */
  treeSeed?: string
}

export type GrowInput = {
  segmentId: string
  anchorX: number
  anchorY: number
  x: number
  y: number
  authorId: string
  authorName: string
}

export type TreeActionResult =
  | { ok: true; nodeId?: string; error?: never }
  | { ok: false; error: string }