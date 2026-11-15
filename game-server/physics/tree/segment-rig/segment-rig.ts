import type Matter from 'matter-js'
import type { TreeRules } from '../../../config/load-game-config.ts'
import type { TreeFrame } from '../../tree-types.ts'
import type { TreeGraph } from '../tree-graph.ts'
import { SegmentLink } from './segment-link.ts'

/** Corpos e juntas dos galhos. A junta permanece colada ao pai. */
export class SegmentRig {
  private links = new Map<string, SegmentLink>()
  private pins: Matter.Body[] = []
  private engine: Matter.Engine
  private matter: typeof Matter
  private tree: TreeRules
  private graph: TreeGraph

  constructor(engine: Matter.Engine, matter: typeof Matter, tree: TreeRules, graph: TreeGraph) {
    this.engine = engine
    this.matter = matter
    this.tree = tree
    this.graph = graph
  }

  sync() {
    this.clear()
    if (!this.graph.root()) return
    for (const node of this.graph.segmentOrder()) {
      const parent = this.graph.node(node.parentId!)
      if (!parent) continue
      const attach = this.graph.segmentStart(parent, node)
      const length = Math.hypot(node.x - attach.x, node.y - attach.y)
      if (length < 1) continue
      const angle = Math.atan2(node.y - attach.y, node.x - attach.x)
      const body = this.matter.Bodies.rectangle(
        (attach.x + node.x) / 2,
        (attach.y + node.y) / 2,
        length,
        this.tree.segmentBodyWidth,
        {
          angle,
          friction: 0.8,
          frictionAir: 0.35,
          restitution: 0,
          density: 0.004,
          isStatic: node.secondaryRoot,
          collisionFilter: { group: -1, category: 0x0002, mask: 0 },
        },
      )
      const parentLink = this.links.get(parent.id)
      const parentBody = parentLink?.body ?? this.pin(attach.x, attach.y)
      const pointA = parentLink ? this.worldToLocal(parentBody, attach.x, attach.y) : { x: 0, y: 0 }
      const constraint = this.matter.Constraint.create({
        bodyA: parentBody,
        pointA,
        bodyB: body,
        pointB: { x: -length / 2, y: 0 },
        length: 0,
        stiffness: 1,
        damping: 0.4,
      })
      this.matter.Composite.add(this.engine.world, [body, constraint])
      this.links.set(node.id, new SegmentLink(node.id, parent.id, body, constraint, length))
    }
  }

  /** Inclina cada galho como um pêndulo e recoloca a ponta de origem na junta. */
  integrate(deltaMs: number) {
    const dt = deltaMs / 1000
    const gravity = this.tree.gravityScale
    for (const link of this.links.values()) {
      if (link.body.isStatic) continue
      const alpha = (3 * gravity * Math.cos(link.body.angle)) / (2 * link.length)
      link.angularVelocity += alpha * dt
      link.angularVelocity *= Math.exp(-0.7 * dt)
      this.matter.Body.setAngle(link.body, link.body.angle + link.angularVelocity * dt, false)
      link.body.angularVelocity = link.angularVelocity
    }
    this.holdJoints()
  }

  holdJoints() {
    for (const link of this.links.values()) {
      const parent = link.constraint.bodyA
      const point = link.constraint.pointA ?? { x: 0, y: 0 }
      if (!parent) continue
      const cosine = Math.cos(parent.angle)
      const sine = Math.sin(parent.angle)
      const jointX = parent.position.x + point.x * cosine - point.y * sine
      const jointY = parent.position.y + point.x * sine + point.y * cosine
      const pose = link.pose()
      this.matter.Body.setPosition(
        link.body,
        {
          x: link.body.position.x + jointX - pose.attachX,
          y: link.body.position.y + jointY - pose.attachY,
        },
        false,
      )
    }
  }

  write(frame: TreeFrame) {
    for (const [nodeId, link] of this.links) {
      const node = frame.nodes.find((item) => item.id === nodeId)
      if (!node) continue
      const stress =
        Math.abs(link.body.angularVelocity) * 10 +
        Math.hypot(link.body.velocity.x, link.body.velocity.y)
      const limit = node.fortified
        ? this.tree.stressThresholdFortified
        : this.tree.stressThresholdNormal
      if (stress > limit) {
        node.broken = true
        this.remove(link)
        continue
      }
      const pose = link.pose()
      node.attach = { x: pose.attachX, y: pose.attachY }
      node.x = pose.x
      node.y = pose.y
    }
  }

  private remove(link: SegmentLink) {
    this.matter.Composite.remove(this.engine.world, link.body)
    this.matter.Composite.remove(this.engine.world, link.constraint)
    this.links.delete(link.nodeId)
  }

  private clear() {
    for (const link of this.links.values()) {
      this.matter.Composite.remove(this.engine.world, link.body)
      this.matter.Composite.remove(this.engine.world, link.constraint)
    }
    this.links.clear()
    for (const pin of this.pins) this.matter.Composite.remove(this.engine.world, pin)
    this.pins = []
  }

  private pin(x: number, y: number) {
    const body = this.matter.Bodies.circle(x, y, Math.max(2, this.tree.segmentBodyWidth / 2), {
      isStatic: true,
      friction: 0.9,
      restitution: 0,
    })
    this.pins.push(body)
    this.matter.Composite.add(this.engine.world, body)
    return body
  }

  private worldToLocal(body: Matter.Body, x: number, y: number) {
    const dx = x - body.position.x
    const dy = y - body.position.y
    const cosine = Math.cos(-body.angle)
    const sine = Math.sin(-body.angle)
    return { x: dx * cosine - dy * sine, y: dx * sine + dy * cosine     }
  }
}
