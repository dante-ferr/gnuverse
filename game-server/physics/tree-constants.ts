import {
  getLoadedTreeRules,
  type TreeRules,
} from '../config/load-game-config.ts'

export type { TreeRules }

export function treeRules(): TreeRules {
  return getLoadedTreeRules()
}

export function actionCosts(tree: TreeRules = treeRules()) {
  return {
    grow: tree.costGrow,
    leaf: tree.costLeaf,
    fortify: tree.costFortify,
    prune: tree.costPrune,
    root: tree.costRoot,
  } as const
}

/** @deprecated Use treeRules() — kept for tests importing symbols. */
export const ACTION_COSTS = actionCosts()

export function terrainConfig(tree: TreeRules = treeRules()) {
  return {
    worldWidth: tree.worldWidth,
    terrainSamples: tree.terrainSamples,
    terrainAmplitude: tree.terrainAmplitude,
    terrainMaxSlope: tree.terrainMaxSlope,
    terrainBaseY: tree.terrainBaseY,
  }
}