import { randomUUID } from 'node:crypto'
import {
  ENERGY_INITIAL,
  FIREFLY_PATH_POINTS,
  TREE_WORLD,
} from './tree-constants.ts'
import type { FireflyState, TreeFrame, TreeNode } from './tree-types.ts'

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

export function generateFireflyPath(): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  let x = randomBetween(120, TREE_WORLD.width - 120)
  let y = randomBetween(900, 1050)
  for (let i = 0; i < FIREFLY_PATH_POINTS; i++) {
    points.push({ x, y })
    y -= randomBetween(180, 260)
    x += randomBetween(-80, 80)
    x = Math.max(80, Math.min(TREE_WORLD.width - 80, x))
    y = Math.max(200, y)
  }
  return points
}

export function createInitialTreeFrame(now: number): TreeFrame {
  const rootId = randomUUID()
  const root: TreeNode = {
    id: rootId,
    x: TREE_WORLD.rootX,
    y: TREE_WORLD.rootY,
    parentId: null,
    authorId: 'cave',
    authorName: 'caverna',
    leaf: false,
    fortified: true,
    secondaryRoot: false,
  }
  return {
    nodes: [root],
    energy: ENERGY_INITIAL,
    turn: { phase: 'idle', phaseEndsAt: null, physicsTick: 0 },
    firefly: {
      path: generateFireflyPath(),
      index: 0,
      active: true,
      phasesSeen: 0,
    },
    flower: { bloomed: false, nodeId: null, energyPhasesAboveZero: 0 },
    outcome: 'playing',
    exit: { ...TREE_WORLD.exit },
    tick: 0,
    simulating: false,
  }
}

export function isLegacyBlockFrame(frame: unknown): boolean {
  return (
    typeof frame === 'object' &&
    frame !== null &&
    'blocks' in frame &&
    !('nodes' in frame)
  )
}