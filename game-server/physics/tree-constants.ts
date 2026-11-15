/** Portrait cave world (Matter.js uses y-down; smaller y is toward the exit). */
export const TREE_WORLD = Object.freeze({
  width: 800,
  height: 1200,
  groundY: 1160,
  exit: Object.freeze({ x: 320, y: 0, width: 160, height: 80 }),
  rootX: 400,
  rootY: 1100,
  maxSegments: 200,
})

export const L_MAX = 90
export const MIN_GROUND_CLEARANCE = 40
export const MIN_UPWARD_DELTA = 20
export const MAX_SECONDARY_ROOTS = 2

export const ENERGY_CAPACITY = 100
export const ENERGY_INITIAL = 40
export const ENERGY_PER_LEAF = 8
export const ENERGY_DRAIN_PER_SEGMENT = 2
export const FIREFLY_RADIUS = 120
export const FIREFLY_PATH_POINTS = 4
export const FIREFLY_MAX_PHASES = 6

export const ACTION_WINDOW_MS = 10_000
export const PHYSICS_PHASE_MS = 4_000
export const WIN_ENERGY_PHASES = 2

export const ACTION_COSTS = Object.freeze({
  grow: 1,
  leaf: 1,
  fortify: 2,
  prune: 1,
  root: 2,
})