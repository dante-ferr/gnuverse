import {
  ENERGY_CAPACITY,
  ENERGY_DRAIN_PER_SEGMENT,
  ENERGY_PER_LEAF,
  FIREFLY_MAX_PHASES,
  FIREFLY_RADIUS,
  PHYSICS_PHASE_MS,
  ACTION_WINDOW_MS,
  WIN_ENERGY_PHASES,
} from '../physics/tree-constants.ts'
import type { TreeFrame } from '../physics/tree-types.ts'
import type { TreeSimulation } from '../physics/tree-simulation.ts'

export function openActionWindow(frame: TreeFrame, now: number): TreeFrame {
  frame.turn.phase = 'actionWindow'
  frame.turn.phaseEndsAt = now + ACTION_WINDOW_MS
  frame.simulating = false
  return frame
}

export function startPhysicsPhase(frame: TreeFrame, now: number): TreeFrame {
  frame.turn.phase = 'physics'
  frame.turn.phaseEndsAt = now + PHYSICS_PHASE_MS
  frame.simulating = true
  return frame
}

export function returnToIdle(frame: TreeFrame): TreeFrame {
  frame.turn.phase = 'idle'
  frame.turn.phaseEndsAt = null
  frame.simulating = false
  return frame
}

export function harvestEnergy(frame: TreeFrame, sim: TreeSimulation): void {
  const fly = frame.firefly
  if (!fly.active || fly.index >= fly.path.length) return
  const { x: fx, y: fy } = fly.path[fly.index]!
  let gain = 0
  for (const leaf of sim.functionalLeaves()) {
    if (Math.hypot(leaf.x - fx, leaf.y - fy) <= FIREFLY_RADIUS) gain += ENERGY_PER_LEAF
  }
  frame.energy = Math.min(ENERGY_CAPACITY, frame.energy + gain)
}

export function drainEnergy(frame: TreeFrame): void {
  const segments = frame.nodes.filter((n) => n.parentId !== null && !n.broken).length
  frame.energy = Math.max(0, frame.energy - segments * ENERGY_DRAIN_PER_SEGMENT)
}

export function advanceFirefly(frame: TreeFrame): void {
  if (!frame.firefly.active) return
  frame.firefly.phasesSeen++
  if (frame.firefly.phasesSeen >= FIREFLY_MAX_PHASES) {
    frame.firefly.active = false
    return
  }
  frame.firefly.index = Math.min(
    frame.firefly.index + 1,
    frame.firefly.path.length - 1,
  )
}

export function checkExitBloom(frame: TreeFrame, sim: TreeSimulation): void {
  if (frame.flower.bloomed) return
  for (const node of frame.nodes) {
    if (node.broken || node.parentId === null) continue
    if (sim.nodeInExit(node)) {
      frame.flower.bloomed = true
      frame.flower.nodeId = node.id
      break
    }
  }
}

export function evaluateStarvation(frame: TreeFrame, sim: TreeSimulation): void {
  if (frame.outcome !== 'playing') return
  if (frame.energy > 0) return
  sim.witherPeripheral()
  frame.nodes = sim.read().nodes
  const leaves = frame.nodes.filter((n) => n.leaf && !n.broken)
  if (sim.mainTrunkGone() || (frame.energy === 0 && leaves.length === 0))
    frame.outcome = 'lost'
}

export function evaluateWin(frame: TreeFrame): void {
  if (frame.outcome !== 'playing' || !frame.flower.bloomed) return
  if (frame.energy > 0) frame.flower.energyPhasesAboveZero++
  else frame.flower.energyPhasesAboveZero = 0
  if (frame.flower.energyPhasesAboveZero >= WIN_ENERGY_PHASES) frame.outcome = 'won'
}

export function evaluateTrunkLoss(frame: TreeFrame, sim: TreeSimulation): void {
  if (frame.outcome !== 'playing') return
  if (sim.mainTrunkGone()) frame.outcome = 'lost'
}

export function publicTreeFrame(frame: TreeFrame, now: number) {
  const phaseRemainingMs =
    frame.turn.phaseEndsAt === null
      ? 0
      : Math.max(0, frame.turn.phaseEndsAt - now)
  return {
    ...frame,
    phaseRemainingMs,
    fireflyPosition: frame.firefly.active
      ? frame.firefly.path[frame.firefly.index] ?? null
      : null,
  }
}