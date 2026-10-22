import Matter from 'matter-js'
import { BLOCKS, WORLD } from './catalog.ts'
import type { BlockState, InitialBlock, Placement } from './types.ts'

/** A block's rigid body, geometry checks and serializable public identity. */
export class BlockBody {
  readonly body: Matter.Body
  private readonly identity: Pick<Placement, 'id' | 'kind' | 'color' | 'authorId'>

  constructor(input: Placement) {
    if (!BlockBody.validPlacement(input)) throw new Error('Invalid block placement')
    const shape = BLOCKS[input.kind]
    this.body = Matter.Bodies.rectangle(input.x, input.y, shape.width, shape.height, {
      angle: input.angle ?? 0,
      friction: 0.65,
      frictionStatic: 0.8,
      frictionAir: 0.012,
      restitution: 0.04,
      sleepThreshold: 60,
    })
    this.identity = {
      id: input.id, kind: input.kind, color: input.color, authorId: input.authorId,
    }
  }

  static validPlacement(value: unknown): value is Placement {
    if (!value || typeof value !== 'object') return false
    const input = value as Record<string, unknown>
    return typeof input.id === 'string' && input.id.length > 0
      && typeof input.kind === 'string' && Object.hasOwn(BLOCKS, input.kind)
      && Number.isFinite(input.x) && Number.isFinite(input.y)
      && Number.isFinite(input.angle ?? 0)
      && typeof input.color === 'string' && typeof input.authorId === 'string'
  }

  static validSnapshot(value: unknown): value is InitialBlock {
    if (!BlockBody.validPlacement(value)) return false
    const input = value as InitialBlock
    return [input.vx ?? 0, input.vy ?? 0, input.angularVelocity ?? 0].every(Number.isFinite)
  }

  static fromSnapshot(input: InitialBlock): BlockBody {
    if (!BlockBody.validSnapshot(input)) throw new Error('Invalid block snapshot')
    const block = new BlockBody(input)
    Matter.Body.setVelocity(block.body, { x: input.vx ?? 0, y: input.vy ?? 0 })
    Matter.Body.setAngularVelocity(block.body, input.angularVelocity ?? 0)
    Matter.Sleeping.set(block.body, input.sleeping === true)
    return block
  }

  fitsWorld(): boolean {
    return this.body.vertices.every(({ x, y }) =>
      x >= 0 && x <= WORLD.width && y >= 0 && y <= WORLD.groundY)
  }

  overlaps(other: BlockBody): boolean {
    const collision = Matter.Collision.collides(this.body, other.body)
    return Boolean(collision && collision.depth > 0.05)
  }

  read(): BlockState {
    return {
      ...this.identity,
      x: this.body.position.x, y: this.body.position.y, angle: this.body.angle,
      vx: this.body.velocity.x, vy: this.body.velocity.y,
      angularVelocity: this.body.angularVelocity, sleeping: this.body.isSleeping,
    }
  }
}
