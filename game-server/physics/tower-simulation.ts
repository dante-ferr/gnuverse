import Matter from 'matter-js'
import { WORLD } from './catalog.ts'
import { BlockBody } from './block-body.ts'
import type { Frame, InitialBlock, Placement, PlaceResult, Simulation } from './types.ts'

const STEP_MS = 1000 / 60
const QUIET_TICKS = 30

/** Owns the authoritative world, fixed physics steps and stabilization window. */
export class TowerSimulation implements Simulation {
  private readonly engine = Matter.Engine.create({ enableSleeping: true })
  private readonly blocks = new Map<string, BlockBody>()
  private tick = 0
  private quietTicks = QUIET_TICKS
  private disposed = false

  constructor(initialBlocks: InitialBlock[] = []) {
    this.engine.positionIterations = 8
    this.engine.velocityIterations = 8
    const floor = Matter.Bodies.rectangle(WORLD.width / 2, WORLD.groundY + 100, 20000, 200, {
      isStatic: true, friction: 0.65,
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
      settled: this.settled(), tick: this.tick,
    }
  }

  place(input: Placement): PlaceResult {
    this.assertLive()
    if (!BlockBody.validPlacement(input)) return { ok: false, error: 'invalid' }
    if (!this.settled()) return { ok: false, error: 'busy' }
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
    Matter.Engine.update(this.engine, STEP_MS)
    this.tick += 1
    this.quietTicks = [...this.blocks.values()].every(block => block.body.isSleeping)
      ? this.quietTicks + 1 : 0
    return this.read()
  }

  restore(saved: InitialBlock[]): void {
    this.assertLive()
    if (!Array.isArray(saved) || saved.length > WORLD.maxBlocks
      || saved.some(block => !BlockBody.validSnapshot(block))
      || new Set(saved.map(block => block.id)).size !== saved.length) {
      throw new Error('Invalid block snapshot')
    }
    for (const block of this.blocks.values()) Matter.Composite.remove(this.engine.world, block.body)
    this.blocks.clear()
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
    this.disposed = true
  }
}
