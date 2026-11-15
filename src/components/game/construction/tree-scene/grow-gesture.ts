import {
  hitTestRoot,
  hitTestSegments,
  hitTestSprout,
  segmentEndpoints,
  snapAnchorToTip,
} from '../../../../../core/tree/segment-geometry.ts'
import { terrainSurfaceY } from '../../../../../core/tree/terrain.ts'
import type { TreeRules } from '../../../../../game-server/config/load-game-config.ts'
import type { TreeFrame, TreeNode } from '../../model/types'
import type { TerrainConfig } from './reach-segments'

export type GrowAnchor = {
  segmentId: string
  x: number
  y: number
  t: number
}

export type GrowPick = { anchor: GrowAnchor; node: TreeNode | null }

/** Escolhe o galho clicado e encosta a âncora na ponta quando o clique está perto dela. */
export class GrowGesture {
  frame: TreeFrame
  rules: TreeRules
  seed: string
  terrain: TerrainConfig

  constructor(frame: TreeFrame, rules: TreeRules, seed: string, terrain: TerrainConfig) {
    this.frame = frame
    this.rules = rules
    this.seed = seed
    this.terrain = terrain
  }

  nodeAt(point: { x: number; y: number }) {
    let best: TreeNode | null = null
    let bestDist = this.rules.nodeHitRadius
    for (const node of this.frame.nodes.filter((item) => !item.broken)) {
      const dist = Math.hypot(node.x - point.x, node.y - point.y)
      if (dist < bestDist) {
        best = node
        bestDist = dist
      }
    }
    return best
  }

  pick(world: { x: number; y: number }): GrowPick | null {
    const nodes = this.frame.nodes.filter((node) => !node.broken)
    const root = nodes.find((node) => node.parentId === null)
    const sprout = root
      ? hitTestSprout(
          root,
          terrainSurfaceY(root.x, this.seed, this.terrain),
          world.x,
          world.y,
          this.rules.segmentHitPadding,
        )
      : null
    const segment =
      hitTestSegments(nodes, world.x, world.y, this.rules.segmentHitPadding) ??
      sprout ??
      hitTestRoot(nodes, world.x, world.y, this.rules.nodeHitRadius)
    if (!segment) return null
    const ends =
      root && segment.segmentId === root.id
        ? {
            ax: root.x,
            ay: terrainSurfaceY(root.x, this.seed, this.terrain),
            bx: root.x,
            by: root.y,
          }
        : segmentEndpoints(nodes, segment.segmentId)
    const child = nodes.find((node) => node.id === segment.segmentId)
    const snapped = ends
      ? snapAnchorToTip(
          segment,
          ends.ax,
          ends.ay,
          ends.bx,
          ends.by,
          root && segment.segmentId === root.id ? null : (child?.parentId ?? null),
          this.rules.nodeHitRadius,
        )
      : segment
    return {
      anchor: {
        segmentId: snapped.segmentId,
        x: snapped.x,
        y: snapped.y,
        t: snapped.t,
      },
      node: nodes.find((node) => node.id === snapped.segmentId) ?? null,
    }
  }
}
