import Matter from 'matter-js'
import { randomUUID } from 'node:crypto'
import { loadGameConfig, type TreeRules } from '../config/load-game-config.ts'
import {
  groundLimitAt,
  terrainForFrame,
  verifyAnchorOnSegment,
} from './map-gen.ts'
import { actionCosts, terrainConfig, treeRules } from './tree-constants.ts'
import type {
  GrowInput,
  TreeActionResult,
  TreeFrame,
  TreeNode,
} from './tree-types.ts'
import { createInitialTreeFrame } from './map-gen.ts'

/** Authoritative tree: logical graph plus Matter bodies during physics phases. */
export class TreeSimulation {
  private frame: TreeFrame
  private tree: TreeRules
  private engine = Matter.Engine.create({ enableSleeping: true })
  private bodies = new Map<
    string,
    {
      nodeId: string
      parentId: string
      body: Matter.Body
      constraint: Matter.Constraint
    }
  >()
  private disposed = false

  constructor(initial?: TreeFrame, tree: TreeRules = treeRules()) {
    this.tree = tree
    this.frame = structuredClone(initial ?? createInitialTreeFrame(0, 'local'))
    this.syncTerrainBodies()
    this.syncBodies()
  }

  read(): TreeFrame {
    this.assertLive()
    return structuredClone(this.frame)
  }

  dispose() {
    this.disposed = true
    Matter.Engine.clear(this.engine)
    this.bodies.clear()
  }

  private assertLive() {
    if (this.disposed) throw new Error('Tree simulation disposed')
  }

  private node(id: string) {
    return this.frame.nodes.find((n) => n.id === id && !n.broken)
  }

  private children(id: string) {
    return this.frame.nodes.filter((n) => n.parentId === id && !n.broken)
  }

  private rootNode() {
    return this.frame.nodes.find((n) => n.parentId === null && !n.broken)
  }

  private distance(ax: number, ay: number, bx: number, by: number) {
    return Math.hypot(ax - bx, ay - by)
  }

  private validateGrow(input: GrowInput): TreeActionResult {
    const anchorCheck = verifyAnchorOnSegment(
      this.frame,
      input.segmentId,
      input.anchorX,
      input.anchorY,
      this.tree,
    )
    if (!anchorCheck.ok) return anchorCheck
    const parent = this.node(input.segmentId)
    if (!parent) return { ok: false, error: 'Segmento inválido.' }
  const groundY = groundLimitAt(input.x, this.frame, this.tree)
    if (input.y >= groundY)
      return { ok: false, error: 'Falta distância do chão.' }
    if (input.anchorY - input.y < this.tree.minUpwardDelta)
      return { ok: false, error: 'O galho deve crescer para cima.' }
    const len = this.distance(
      input.anchorX,
      input.anchorY,
      input.x,
      input.y,
    )
    if (len > this.tree.lMax) return { ok: false, error: 'Segmento longo demais.' }
    if (len < this.tree.minSegmentLength)
      return { ok: false, error: 'Segmento curto demais.' }
    const m = this.tree.worldMargin
    if (
      input.x < m ||
      input.x > this.tree.worldWidth - m ||
      input.y < m
    )
      return { ok: false, error: 'Fora da caverna.' }
    if (
      this.frame.nodes.filter((n) => !n.broken).length >=
      loadGameConfig().rules.maxSegments
    )
      return { ok: false, error: 'Limite de galhos.' }
    return { ok: true }
  }

  grow(input: GrowInput): TreeActionResult {
    const check = this.validateGrow(input)
    if (!check.ok) return check
    const node: TreeNode = {
      id: randomUUID(),
      x: input.x,
      y: input.y,
      parentId: input.segmentId,
      authorId: input.authorId,
      authorName: input.authorName,
      leaf: false,
      fortified: false,
      secondaryRoot: false,
      attach: { x: input.anchorX, y: input.anchorY },
    }
    this.frame.nodes.push(node)
    return { ok: true, nodeId: node.id }
  }

  placeLeaf(nodeId: string): TreeActionResult {
    const node = this.node(nodeId)
    if (!node) return { ok: false, error: 'Nó inválido.' }
    if (node.leaf) return { ok: false, error: 'Folha já existe.' }
    node.leaf = true
    return { ok: true }
  }

  fortify(nodeId: string): TreeActionResult {
    const node = this.node(nodeId)
    if (!node) return { ok: false, error: 'Nó inválido.' }
    if (node.parentId === null) return { ok: false, error: 'Raiz já é fortificada.' }
    if (node.fortified) return { ok: false, error: 'Já fortificado.' }
    node.fortified = true
    return { ok: true }
  }

  prune(nodeId: string): TreeActionResult {
    const node = this.node(nodeId)
    if (!node) return { ok: false, error: 'Nó inválido.' }
    if (node.parentId === null) return { ok: false, error: 'Não pode podar a raiz.' }
    if (this.children(nodeId).length) return { ok: false, error: 'Só galhos sem descendentes.' }
    const idx = this.frame.nodes.findIndex((n) => n.id === nodeId)
    if (idx >= 0) this.frame.nodes.splice(idx, 1)
    return { ok: true }
  }

  secondaryRoot(parentId: string, x: number, y: number): TreeActionResult {
    const parent = this.node(parentId)
    if (!parent) return { ok: false, error: 'Nó inválido.' }
    if (y <= parent.y + this.tree.minUpwardDelta)
      return { ok: false, error: 'Raiz secundária só para baixo.' }
    if (y >= groundLimitAt(x, this.frame, this.tree))
      return { ok: false, error: 'Deve alcançar o chão.' }
    const count = this.frame.nodes.filter((n) => n.secondaryRoot && !n.broken).length
    if (count >= this.tree.maxSecondaryRoots)
      return { ok: false, error: 'Limite de raízes secundárias.' }
    const len = this.distance(parent.x, parent.y, x, y)
    if (len > this.tree.lMax) return { ok: false, error: 'Segmento longo demais.' }
    const node: TreeNode = {
      id: randomUUID(),
      x,
      y,
      parentId,
      authorId: parent.authorId,
      authorName: parent.authorName,
      leaf: false,
      fortified: true,
      secondaryRoot: true,
    }
    this.frame.nodes.push(node)
    return { ok: true, nodeId: node.id }
  }

  setFrame(frame: TreeFrame) {
    this.frame = structuredClone(frame)
    this.syncTerrainBodies()
    this.syncBodies()
  }

  setPhase(phase: TreeFrame['turn']['phase'], endsAt: number | null, simulating: boolean) {
    this.frame.turn.phase = phase
    this.frame.turn.phaseEndsAt = endsAt
    this.frame.simulating = simulating
    if (phase === 'physics') this.syncBodies()
  }

  patchFrame(patch: Partial<TreeFrame>) {
    Object.assign(this.frame, patch)
  }

  private syncTerrainBodies() {
    const existing = this.engine.world.bodies.filter((b) =>
      (b as Matter.Body & { label?: string }).label?.startsWith('terrain-'),
    )
    for (const body of existing) Matter.Composite.remove(this.engine.world, body)
    const line = terrainForFrame(this.frame, this.tree)
    const seed = this.frame.treeSeed ?? 'default'
    const bottom = this.tree.worldHeight
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i]!
      const b = line[i + 1]!
      const verts = [
        { x: a.x, y: a.y },
        { x: b.x, y: b.y },
        { x: b.x, y: bottom },
        { x: a.x, y: bottom },
      ]
      const cx = (a.x + b.x) / 2
      const cy = (a.y + bottom) / 2
      const chunk = Matter.Bodies.fromVertices(
        cx,
        cy,
        [verts],
        {
          isStatic: true,
          friction: 0.9,
          restitution: 0,
          label: `terrain-${i}`,
        },
        true,
      )
      Matter.Composite.add(this.engine.world, chunk)
    }
    void seed
  }

  private segmentStart(parent: TreeNode, child: TreeNode) {
    return child.attach ?? { x: parent.x, y: parent.y }
  }

  private syncBodies() {
    for (const segment of this.bodies.values()) {
      Matter.Composite.remove(this.engine.world, segment.body)
      Matter.Composite.remove(this.engine.world, segment.constraint)
    }
    this.bodies.clear()
    const root = this.rootNode()
    if (!root) return
    const staticRoots = new Map<string, Matter.Body>()
    const pin = (node: TreeNode, fixed: boolean) => {
      const body = Matter.Bodies.circle(node.x, node.y, 6, {
        isStatic: fixed,
        friction: 0.8,
        restitution: 0,
        density: 0.002,
      })
      staticRoots.set(node.id, body)
      Matter.Composite.add(this.engine.world, body)
      return body
    }
    pin(root, true)
    const w = this.tree.segmentBodyWidth
    for (const node of this.frame.nodes) {
      if (node.broken || node.parentId === null) continue
      const parent = this.node(node.parentId)
      if (!parent) continue
      const attach = this.segmentStart(parent, node)
      let parentBody = staticRoots.get(parent.id)
      if (!parentBody) parentBody = pin(parent, parent.secondaryRoot)
      const midX = (attach.x + node.x) / 2
      const midY = (attach.y + node.y) / 2
      const angle = Math.atan2(node.y - attach.y, node.x - attach.x)
      const length = this.distance(attach.x, attach.y, node.x, node.y)
      const body = Matter.Bodies.rectangle(midX, midY, length, w, {
        angle,
        friction: 0.6,
        frictionAir: 0.02,
        restitution: 0,
        density: 0.001,
      })
      const childBody = pin(node, node.secondaryRoot)
      const constraint = Matter.Constraint.create({
        bodyA: parentBody,
        pointA: {
          x: (parent.x - midX) * Math.cos(-angle) - (parent.y - midY) * Math.sin(-angle),
          y: (parent.x - midX) * Math.sin(-angle) + (parent.y - midY) * Math.cos(-angle),
        },
        bodyB: body,
        length: 0,
        stiffness: node.fortified ? 0.95 : 0.75,
        damping: 0.08,
      })
      Matter.Constraint.create({
        bodyA: body,
        bodyB: childBody,
        length: 0,
        stiffness: node.fortified ? 0.95 : 0.75,
        damping: 0.08,
      })
      Matter.Composite.add(this.engine.world, [body, constraint])
      this.bodies.set(node.id, { nodeId: node.id, parentId: parent.id, body, constraint })
    }
  }

  step(): TreeFrame {
    this.assertLive()
    const stepMs = 1000 / this.tree.physicsFps
    for (let i = 0; i < this.tree.physicsSubsteps; i++) {
      Matter.Engine.update(this.engine, stepMs / this.tree.physicsSubsteps)
    }
    for (const [nodeId, segment] of this.bodies) {
      const node = this.frame.nodes.find((n) => n.id === nodeId)
      if (!node) continue
      const stress =
        Math.abs(segment.body.angularVelocity) * 10 +
        Math.hypot(segment.body.velocity.x, segment.body.velocity.y)
      const limit = node.fortified
        ? this.tree.stressThresholdFortified
        : this.tree.stressThresholdNormal
      if (stress > limit) {
        node.broken = true
        Matter.Composite.remove(this.engine.world, segment.body)
        Matter.Composite.remove(this.engine.world, segment.constraint)
        this.bodies.delete(nodeId)
      } else {
        const childBody = segment.body
        const tips = this.children(nodeId)
        if (!tips.length) {
          node.x = childBody.position.x + (node.x - segment.body.position.x) * 0.1
          node.y = childBody.position.y + (node.y - segment.body.position.y) * 0.1
        }
      }
    }
    this.frame.tick++
    this.frame.turn.physicsTick++
    return this.read()
  }

  restore(frame: TreeFrame) {
    this.frame = structuredClone(frame)
    if (!this.frame.treeSeed) this.frame.treeSeed = 'legacy'
    this.syncTerrainBodies()
    this.syncBodies()
  }

  witherPeripheral() {
    let changed = true
    while (changed) {
      changed = false
      for (const node of [...this.frame.nodes]) {
        if (node.broken || node.parentId === null || node.fortified) continue
        if (this.children(node.id).length) continue
        const idx = this.frame.nodes.findIndex((n) => n.id === node.id)
        if (idx >= 0) {
          this.frame.nodes.splice(idx, 1)
          changed = true
        }
      }
    }
  }

  mainTrunkGone() {
    const root = this.rootNode()
    if (!root) return true
    if (root.broken) return true
    return false
  }

  functionalLeaves() {
    return this.frame.nodes.filter((n) => n.leaf && !n.broken)
  }

  nodeInExit(node: TreeNode) {
    const e = this.frame.exit
    return (
      node.x >= e.x &&
      node.x <= e.x + e.width &&
      node.y >= e.y &&
      node.y <= e.y + e.height
    )
  }

  costs() {
    return actionCosts(this.tree)
  }
}