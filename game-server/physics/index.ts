import { TowerSimulation } from './tower-simulation.ts'
import type { InitialBlock, Simulation } from './types.ts'

export { WORLD, BLOCKS } from './catalog.ts'
export { BlockBody } from './block-body.ts'
export { TowerSimulation } from './tower-simulation.ts'
export type { BlockKind, Placement, BlockState, Frame, InitialBlock, PlaceResult, Simulation } from './types.ts'

export function createSimulation(initialBlocks: InitialBlock[] = []): Simulation {
  return new TowerSimulation(initialBlocks)
}
