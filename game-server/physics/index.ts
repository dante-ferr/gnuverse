import { TreeSimulation } from './tree/tree-simulation.ts'
import type { TreeFrame } from './tree-types.ts'
import { TowerSimulation } from './tower-simulation.ts'
import type { InitialBlock, Simulation } from './types.ts'

export { WORLD, BLOCKS } from './catalog.ts'
export { actionCosts, treeRules, terrainConfig } from './tree-constants.ts'
export { BlockBody } from './block-body.ts'
export { TowerSimulation } from './tower-simulation.ts'
export { TreeSimulation } from './tree/tree-simulation.ts'
export { createInitialTreeFrame, isLegacyBlockFrame } from './map-gen.ts'
export type { TreeFrame, TreeNode, FireflyState, TurnPhase } from './tree-types.ts'
export type {
  BlockKind,
  Placement,
  BlockState,
  ShardState,
  Frame,
  InitialBlock,
  PlaceResult,
  Simulation,
} from './types.ts'

export function createTreeSimulation(initial?: TreeFrame): TreeSimulation {
  return new TreeSimulation(initial)
}

/** @deprecated Block tower simulations; kept for legacy tests only. */
export function createSimulation(initialBlocks: InitialBlock[] = []): Simulation {
  return new TowerSimulation(initialBlocks)
}