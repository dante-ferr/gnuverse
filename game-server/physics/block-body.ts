import Matter from 'matter-js'
import { BLOCKS, WORLD } from './catalog.ts'
import type { BlockState, InitialBlock, Placement } from './types.ts'

export type ShardFragment = {
  x: number
  y: number
  width: number
  height: number
  angle: number
  vx: number
  vy: number
  angularVelocity: number
}

// Kinetic contact friction. Static hold against wind is enforced in slide-hold.ts.
const CONTACT_FRICTION = 0.95
const CONTACT_STATIC_MULTIPLIER = 1.5

/** A block's rigid body, geometry checks and serializable public identity. */
export class BlockBody {
  readonly body: Matter.Body
  private readonly identity: Pick<Placement, 'id' | 'kind' | 'color' | 'authorId'>

  constructor(input: Placement) {
    if (!BlockBody.validPlacement(input)) throw new Error('Invalid block placement')
    const shape = BLOCKS[input.kind]
    this.body = Matter.Bodies.rectangle(input.x, input.y, shape.width, shape.height, {
      angle: input.angle ?? 0,
      friction: CONTACT_FRICTION,
      frictionStatic: CONTACT_STATIC_MULTIPLIER,
      frictionAir: 0.012,
      restitution: 0,
      slop: 0.01,
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

  /** True once any corner leaves the horizontal span the piece was allowed to occupy. */
  outsideHorizontal(): boolean {
    return this.body.vertices.some(({ x }) => x < 0 || x > WORLD.width)
  }

  /**
   * Splits the rectangle into smaller pieces that inherit the body's motion
   * and fly apart from its center.
   */
  fragments(): ShardFragment[] {
    const shape = BLOCKS[this.identity.kind]
    const columns = shape.width >= 90 ? 3 : 2
    const rows = shape.height >= 90 ? 3 : 2
    const { x: centerX, y: centerY } = this.body.position
    const angle = this.body.angle
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const span = Math.max(shape.width, shape.height) / 2
    const pieces: ShardFragment[] = []
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const localX = ((column + 0.5) / columns - 0.5) * shape.width
        const localY = ((row + 0.5) / rows - 0.5) * shape.height
        pieces.push({
          x: centerX + localX * cos - localY * sin,
          y: centerY + localX * sin + localY * cos,
          width: (shape.width / columns) * 0.72,
          height: (shape.height / rows) * 0.72,
          angle,
          vx: this.body.velocity.x + (localX / span) * 0.14,
          vy: this.body.velocity.y + (localY / span) * 0.14 - 0.05,
          angularVelocity:
            this.body.angularVelocity + (column - (columns - 1) / 2) * 0.006,
        })
      }
    }
    return pieces
  }

  overlaps(other: BlockBody): boolean {
    const collision = Matter.Collision.collides(this.body, other.body)
    return Boolean(collision && collision.depth > 0.05)
  }

  applyWind(acceleration: number, direction: 1 | -1): void {
    Matter.Sleeping.set(this.body, false)
    Matter.Body.applyForce(this.body, this.body.position, {
      x: this.body.mass * acceleration * direction,
      y: 0,
    })
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
