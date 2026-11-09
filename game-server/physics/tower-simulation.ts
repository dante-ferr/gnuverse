import Matter from 'matter-js'
import { WORLD } from './catalog.ts'
import { BlockBody } from './block-body.ts'
import { holdRestingContacts } from './slide-hold.ts'
import type { Frame, InitialBlock, Placement, PlaceResult, ShardState, Simulation } from './types.ts'

const STEP_MS = 1000 / 60
const SUBSTEPS = 8
const QUIET_TICKS = 30
const CONTACT_FRICTION = 0.95
const CONTACT_STATIC_MULTIPLIER = 1.5
const SHARD_LIFE = 75
const SHARD_MARGIN = 180

type Shard = {
  id: string
  body: Matter.Body
  born: number
  width: number
  height: number
}

/** Owns the authoritative world, fixed physics steps and stabilization window. */
export class TowerSimulation implements Simulation {
  private readonly engine = Matter.Engine.create({ enableSleeping: true })
  private readonly blocks = new Map<string, BlockBody>()
  private readonly shards = new Map<string, Shard>()
  private tick = 0
  private quietTicks = QUIET_TICKS
  private disposed = false
  private wind: { strength: number; direction: 1 | -1 } | null = null

  constructor(initialBlocks: InitialBlock[] = []) {
    this.engine.positionIterations = 32
    this.engine.velocityIterations = 24
    const floor = Matter.Bodies.rectangle(WORLD.width / 2, WORLD.groundY + 100, 20000, 200, {
      isStatic: true,
      friction: CONTACT_FRICTION,
      frictionStatic: CONTACT_STATIC_MULTIPLIER,
      restitution: 0,
      slop: 0.01,
    })
    Matter.Composite.add(this.engine.world, floor)
    this.restore(initialBlocks)
  }

  private assertLive(): void {
    if (this.disposed) throw new Error('Simulation has been disposed')
  }

  private settled(): boolean {
    return this.blocks.size === 0 || this.quietTicks >= QUIET_TICKS
  }

  read(): Frame {
    this.assertLive()
    return {
      blocks: [...this.blocks.values()].map(block => block.read()),
      shards: [...this.shards.values()].map(shard => this.readShard(shard)),
      settled: this.settled(), tick: this.tick,
    }
  }

  private readShard(shard: Shard): ShardState {
    return {
      id: shard.id,
      x: shard.body.position.x,
      y: shard.body.position.y,
      angle: shard.body.angle,
      width: shard.width,
      height: shard.height,
    }
  }

  /** Replaces a block that left the allowed horizontal span with short-lived debris. */
  private shatterEscaped(): void {
    for (const block of [...this.blocks.values()]) {
      if (!block.outsideHorizontal()) continue
      const state = block.read()
      const pieces = block.fragments()
      this.blocks.delete(state.id)
      Matter.Composite.remove(this.engine.world, block.body)
      pieces.forEach((piece, index) => {
        const id = `${state.id}:${this.tick}:${index}`
        const body = Matter.Bodies.rectangle(piece.x, piece.y, piece.width, piece.height, {
          angle: piece.angle,
          friction: 0.4,
          frictionAir: 0.03,
          restitution: 0.45,
          density: 0.00015,
          collisionFilter: { group: -1 },
          sleepThreshold: 40,
        })
        Matter.Body.setVelocity(body, { x: piece.vx, y: piece.vy })
        Matter.Body.setAngularVelocity(body, piece.angularVelocity)
        const shard: Shard = {
          id, body, born: this.tick, width: piece.width, height: piece.height,
        }
        this.shards.set(id, shard)
        Matter.Composite.add(this.engine.world, body)
      })
    }
    for (const [id, shard] of this.shards) {
      const { x, y } = shard.body.position
      const agedOut = this.tick - shard.born > SHARD_LIFE
      const left =
        x < -SHARD_MARGIN || x > WORLD.width + SHARD_MARGIN || y < -SHARD_MARGIN || y > WORLD.height + 40
      if (!agedOut && !left) continue
      Matter.Composite.remove(this.engine.world, shard.body)
      this.shards.delete(id)
    }
  }

  place(input: Placement): PlaceResult {
    this.assertLive()
    if (!BlockBody.validPlacement(input)) return { ok: false, error: 'invalid' }
    if (this.blocks.size >= WORLD.maxBlocks) return { ok: false, error: 'limit' }
    if (this.blocks.has(input.id)) return { ok: false, error: 'duplicate' }
    const block = new BlockBody(input)
    if (!block.fitsWorld()) return { ok: false, error: 'bounds' }
    for (const other of this.blocks.values()) {
      if (block.overlaps(other)) return { ok: false, error: 'overlap' }
    }
    this.blocks.set(input.id, block)
    Matter.Composite.add(this.engine.world, block.body)
    this.quietTicks = 0
    return { ok: true }
  }

  step(): Frame {
    this.assertLive()
    // Matter clears forces after every update, so reapply during each substep.
    for (let index = 0; index < SUBSTEPS; index += 1) {
      const wind = this.wind
      if (wind) for (const block of this.blocks.values()) {
        block.applyWind(wind.strength * this.engine.gravity.scale, wind.direction)
      }
      const poses = new Map([...this.blocks.values()].map(block => [
        block.body.id,
        { x: block.body.position.x, y: block.body.position.y, angle: block.body.angle },
      ]))
      Matter.Engine.update(this.engine, STEP_MS / SUBSTEPS)
      const gravity = this.engine.gravity.scale
      holdRestingContacts(this.engine.pairs.list, poses, {
        x: (wind?.strength ?? 0) * gravity * (wind?.direction ?? 1),
        y: this.engine.gravity.y * gravity,
      })
    }
    this.wind = null
    this.shatterEscaped()
    this.tick += 1
    this.quietTicks = [...this.blocks.values()].every(block => block.body.isSleeping)
      ? this.quietTicks + 1 : 0
    return this.read()
  }

  applyWind(strength: number, direction: 1 | -1): void {
    this.assertLive()
    if (!Number.isFinite(strength) || strength < 0 || strength > 1
      || (direction !== 1 && direction !== -1)) throw new Error('Invalid wind')
    if (strength === 0) { this.wind = null; return }
    this.wind = { strength, direction }
    for (const block of this.blocks.values()) Matter.Sleeping.set(block.body, false)
    this.quietTicks = 0
  }

  restore(saved: InitialBlock[]): void {
    this.assertLive()
    if (!Array.isArray(saved) || saved.length > WORLD.maxBlocks
      || saved.some(block => !BlockBody.validSnapshot(block))
      || new Set(saved.map(block => block.id)).size !== saved.length) {
      throw new Error('Invalid block snapshot')
    }
    for (const block of this.blocks.values()) Matter.Composite.remove(this.engine.world, block.body)
    for (const shard of this.shards.values()) Matter.Composite.remove(this.engine.world, shard.body)
    this.blocks.clear()
    this.shards.clear()
    this.wind = null
    Matter.Engine.clear(this.engine)
    for (const input of saved) {
      const block = BlockBody.fromSnapshot(input)
      this.blocks.set(input.id, block)
      Matter.Composite.add(this.engine.world, block.body)
    }
    this.quietTicks = [...this.blocks.values()].every(block => block.body.isSleeping)
      ? QUIET_TICKS : 0
  }

  dispose(): void {
    if (this.disposed) return
    Matter.Composite.clear(this.engine.world, false)
    Matter.Engine.clear(this.engine)
    this.blocks.clear()
    this.shards.clear()
    this.disposed = true
  }
}
