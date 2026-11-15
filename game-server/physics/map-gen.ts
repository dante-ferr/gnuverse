import { randomUUID } from 'node:crypto'
import {
  rootAnchorY,
  terrainPolyline,
  terrainSurfaceY,
} from '../../core/tree/terrain.ts'
import { segmentEndpoints, projectOnSegment } from '../../core/tree/segment-geometry.ts'
import type { TreeRules } from '../config/load-game-config.ts'
import { terrainConfig, treeRules } from './tree-constants.ts'
import type { FireflyState, TreeFrame, TreeNode } from './tree-types.ts'

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

export function generateFireflyPath(
  tree: TreeRules = treeRules(),
  seed: string,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  let x = randomBetween(
    tree.fireflyXMargin,
    tree.worldWidth - tree.fireflyXMargin,
  )
  let y = randomBetween(tree.fireflyYStartMin, tree.fireflyYStartMax)
  for (let i = 0; i < tree.fireflyPathPoints; i++) {
    points.push({ x, y })
    y -= randomBetween(tree.fireflyStepYMin, tree.fireflyStepYMax)
    x += randomBetween(-tree.fireflyStepX, tree.fireflyStepX)
    x = Math.max(
      tree.fireflyXMargin,
      Math.min(tree.worldWidth - tree.fireflyXMargin, x),
    )
    y = Math.max(tree.fireflyYLow, y)
  }
  void seed
  return points
}

export function createInitialTreeFrame(
  now: number,
  treeId: string,
  tree: TreeRules = treeRules(),
): TreeFrame {
  const rootId = randomUUID()
  const terrain = terrainConfig(tree)
  const rootY = rootAnchorY(
    treeId,
    tree.rootX,
    tree.rootClearanceAboveTerrain,
    terrain,
  )
  const root: TreeNode = {
    id: rootId,
    x: tree.rootX,
    y: rootY,
    parentId: null,
    authorId: 'cave',
    authorName: 'caverna',
    leaf: false,
    fortified: true,
    secondaryRoot: false,
  }
  return {
    nodes: [root],
    energy: tree.energyInitial,
    turn: { phase: 'idle', phaseEndsAt: null, physicsTick: 0 },
    firefly: {
      path: generateFireflyPath(tree, treeId),
      index: 0,
      active: true,
      phasesSeen: 0,
    },
    flower: { bloomed: false, nodeId: null, energyPhasesAboveZero: 0 },
    outcome: 'playing',
    exit: {
      x: tree.exitX,
      y: tree.exitY,
      width: tree.exitWidth,
      height: tree.exitHeight,
    },
    tick: 0,
    simulating: false,
    treeSeed: treeId,
  }
}

export function terrainForFrame(
  frame: TreeFrame,
  tree: TreeRules = treeRules(),
): { x: number; y: number }[] {
  const seed = frame.treeSeed ?? 'default'
  return terrainPolyline(seed, terrainConfig(tree))
}

export function groundLimitAt(
  x: number,
  frame: TreeFrame,
  tree: TreeRules = treeRules(),
): number {
  const seed = frame.treeSeed ?? 'default'
  const surface = terrainSurfaceY(x, seed, terrainConfig(tree))
  return surface - tree.minGroundClearance
}

export function verifyAnchorOnSegment(
  frame: TreeFrame,
  segmentId: string,
  anchorX: number,
  anchorY: number,
  tree: TreeRules = treeRules(),
): { ok: true } | { ok: false; error: string } {
  const nodes = frame.nodes.filter((n) => !n.broken)
  const root = nodes.find((n) => n.parentId === null)
  if (root && segmentId === root.id) {
    const dist = Math.hypot(anchorX - root.x, anchorY - root.y)
    if (dist > tree.growAnchorTolerance) {
      return { ok: false, error: 'Âncora longe da raiz.' }
    }
    return { ok: true }
  }
  const ends = segmentEndpoints(nodes, segmentId)
  if (!ends) return { ok: false, error: 'Segmento inválido.' }
  const hit = projectOnSegment(
    ends.ax,
    ends.ay,
    ends.bx,
    ends.by,
    anchorX,
    anchorY,
  )
  if (hit.dist > tree.growAnchorTolerance) {
    return { ok: false, error: 'Âncora fora do segmento.' }
  }
  return { ok: true }
}

export function isLegacyBlockFrame(frame: unknown): boolean {
  return (
    typeof frame === 'object' &&
    frame !== null &&
    'blocks' in frame &&
    !('nodes' in frame)
  )
}