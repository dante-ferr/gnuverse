import type Matter from 'matter-js'
import type { TreeRules } from '../../config/load-game-config.ts'
import { terrainForFrame } from '../map-gen.ts'
import type { TreeFrame } from '../tree-types.ts'

/** Corpos estáticos do chão da caverna. */
export class TerrainCollider {
  private engine: Matter.Engine
  private matter: typeof Matter
  private tree: TreeRules

  constructor(engine: Matter.Engine, matter: typeof Matter, tree: TreeRules) {
    this.engine = engine
    this.matter = matter
    this.tree = tree
  }

  sync(frame: TreeFrame) {
    const existing = this.engine.world.bodies.filter((body) => body.label?.startsWith('terrain-'))
    for (const body of existing) this.matter.Composite.remove(this.engine.world, body)
    const line = terrainForFrame(frame, this.tree)
    const bottom = this.tree.worldHeight
    for (let index = 0; index < line.length - 1; index++) {
      const start = line[index]!
      const end = line[index + 1]!
      const centerX = (start.x + end.x) / 2
      const centerY = (start.y + bottom) / 2
      const chunk = this.matter.Bodies.fromVertices(
        centerX,
        centerY,
        [[
          { x: start.x, y: start.y },
          { x: end.x, y: end.y },
          { x: end.x, y: bottom },
          { x: start.x, y: bottom },
        ]],
        {
          isStatic: true,
          friction: 0.9,
          restitution: 0,
          label: `terrain-${index}`,
        },
        true,
      )
      this.matter.Composite.add(this.engine.world, chunk)
    }
  }
}
