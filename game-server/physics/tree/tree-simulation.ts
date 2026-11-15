import Matter from 'matter-js'
import type { TreeRules } from '../../config/load-game-config.ts'
import { actionCosts, treeRules } from '../tree-constants.ts'
import type { GrowInput, TreeActionResult, TreeFrame, TreeNode } from '../tree-types.ts'
import { createInitialTreeFrame } from '../map-gen.ts'
import { BranchActions } from './branch-actions.ts'
import { SegmentRig } from './segment-rig/segment-rig.ts'
import { TerrainCollider } from './terrain-collider.ts'
import { TreeGraph } from './tree-graph.ts'

/** Estado autoritativo da árvore: grafo lógico mais corpos durante a física. */
export class TreeSimulation {
  private frame: TreeFrame
  private tree: TreeRules
  private engine = Matter.Engine.create({ enableSleeping: false })
  private graph: TreeGraph
  private actions: BranchActions
  private terrain: TerrainCollider
  private rig: SegmentRig
  private disposed = false

  constructor(initial?: TreeFrame, tree: TreeRules = treeRules()) {
    this.tree = tree
    this.frame = structuredClone(initial ?? createInitialTreeFrame(0, 'local'))
    this.engine.gravity.x = 0
    this.engine.gravity.y = 1
    this.engine.gravity.scale = tree.gravityScale
    this.graph = new TreeGraph(this.frame)
    this.actions = new BranchActions(this.graph, tree)
    this.terrain = new TerrainCollider(this.engine, Matter, tree)
    this.rig = new SegmentRig(this.engine, Matter, tree, this.graph)
    this.terrain.sync(this.frame)
    this.rig.sync()
  }

  read(): TreeFrame {
    this.assertLive()
    return structuredClone(this.frame)
  }

  dispose() {
    this.disposed = true
    Matter.Engine.clear(this.engine)
  }

  grow(input: GrowInput): TreeActionResult {
    return this.actions.grow(input)
  }

  placeLeaf(nodeId: string): TreeActionResult {
    return this.actions.placeLeaf(nodeId)
  }

  fortify(nodeId: string): TreeActionResult {
    return this.actions.fortify(nodeId)
  }

  prune(nodeId: string): TreeActionResult {
    return this.actions.prune(nodeId)
  }

  secondaryRoot(parentId: string, x: number, y: number): TreeActionResult {
    return this.actions.secondaryRoot(parentId, x, y)
  }

  setFrame(frame: TreeFrame) {
    this.replace(frame)
  }

  restore(frame: TreeFrame) {
    if (!frame.treeSeed) frame.treeSeed = 'legacy'
    this.replace(frame)
  }

  setPhase(phase: TreeFrame['turn']['phase'], endsAt: number | null, simulating: boolean) {
    this.frame.turn.phase = phase
    this.frame.turn.phaseEndsAt = endsAt
    this.frame.simulating = simulating
    if (phase === 'physics') this.rig.sync()
  }

  patchFrame(patch: Partial<TreeFrame>) {
    Object.assign(this.frame, patch)
  }

  /** Avança exatamente `deltaMs` de simulação, o mesmo intervalo do relógio. */
  step(deltaMs = 1000 / this.tree.physicsFps): TreeFrame {
    this.assertLive()
    const slices = Math.max(1, this.tree.physicsSubsteps)
    const slice = deltaMs / slices
    for (let index = 0; index < slices; index++) this.rig.integrate(slice)
    this.rig.write(this.frame)
    this.frame.tick++
    this.frame.turn.physicsTick++
    return this.read()
  }

  witherPeripheral() {
    this.actions.witherPeripheral()
  }

  mainTrunkGone() {
    const root = this.graph.root()
    return !root || Boolean(root.broken)
  }

  functionalLeaves() {
    return this.frame.nodes.filter((node) => node.leaf && !node.broken)
  }

  nodeInExit(node: TreeNode) {
    const exit = this.frame.exit
    return (
      node.x >= exit.x &&
      node.x <= exit.x + exit.width &&
      node.y >= exit.y &&
      node.y <= exit.y + exit.height
    )
  }

  costs() {
    return actionCosts(this.tree)
  }

  private replace(frame: TreeFrame) {
    this.frame = structuredClone(frame)
    this.graph.frame = this.frame
    this.terrain.sync(this.frame)
    this.rig.sync()
  }

  private assertLive() {
    if (this.disposed) throw new Error('Tree simulation disposed')
  }
}
