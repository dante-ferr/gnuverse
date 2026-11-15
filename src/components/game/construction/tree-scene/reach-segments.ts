import type { ReachSegment } from '../../../../../core/tree/reach-mask.ts'
import type { TreeRules } from '../../../../../game-server/config/load-game-config.ts'
import { terrainSurfaceY } from '../../../../../core/tree/terrain.ts'
import type { TreeFrame } from '../../model/types'

export type TerrainConfig = {
  worldWidth: number
  terrainSamples: number
  terrainAmplitude: number
  terrainMaxSlope: number
  terrainBaseY: number
}

/** Segmentos usados pelo alcance e pelo acompanhamento da âncora. */
export class ReachSegments {
  static terrain(rules: TreeRules): TerrainConfig {
    return {
      worldWidth: rules.worldWidth,
      terrainSamples: rules.terrainSamples,
      terrainAmplitude: rules.terrainAmplitude,
      terrainMaxSlope: rules.terrainMaxSlope,
      terrainBaseY: rules.terrainBaseY,
    }
  }

  static collect(nodes: TreeFrame['nodes'], seed: string, terrain: TerrainConfig): ReachSegment[] {
    const live = nodes.filter((node) => !node.broken)
    const byId = new Map(live.map((node) => [node.id, node]))
    const segments: ReachSegment[] = []
    const root = live.find((node) => node.parentId === null)
    if (root) {
      segments.push({
        id: root.id,
        ax: root.x,
        ay: terrainSurfaceY(root.x, seed, terrain),
        bx: root.x,
        by: root.y,
      })
    }
    for (const node of live) {
      if (!node.parentId) continue
      const parent = byId.get(node.parentId)
      if (!parent) continue
      const start = node.attach ?? parent
      segments.push({
        id: node.id,
        ax: start.x,
        ay: start.y,
        bx: node.x,
        by: node.y,
      })
    }
    return segments
  }

  static pointAt(segment: ReachSegment, t: number) {
    return {
      x: segment.ax + (segment.bx - segment.ax) * t,
      y: segment.ay + (segment.by - segment.ay) * t,
    }
  }
}
