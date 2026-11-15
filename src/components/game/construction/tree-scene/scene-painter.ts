import { reachBoundary } from '../../../../../core/tree/reach-mask.ts'
import { terrainPolyline, terrainSurfaceY } from '../../../../../core/tree/terrain.ts'
import type { TreeRules } from '../../../../../game-server/config/load-game-config.ts'
import type { TreeFrame } from '../../model/types'
import type { GrowAnchor } from './grow-gesture'
import { ReachSegments, type TerrainConfig } from './reach-segments'
import type { SceneView } from './scene-view'

/** Desenha terreno, galhos, saída, vaga-lume e o alcance do próximo galho. */
export class ScenePainter {
  paint(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    frame: TreeFrame,
    rules: TreeRules,
    seed: string,
    terrain: TerrainConfig,
    growAnchor: GrowAnchor | null,
    growPreview: { x: number; y: number } | null,
  ) {
    ctx.fillStyle = rules.colorBackground
    ctx.fillRect(0, 0, view.width, view.height)
    this.terrain(ctx, view, seed, terrain, rules)
    this.branches(ctx, view, frame, rules, seed, terrain)
    this.exit(ctx, view, frame, rules)
    this.firefly(ctx, view, frame, rules)
    this.leaves(ctx, view, frame, rules)
    if (growAnchor) this.reach(ctx, view, frame, rules, seed, terrain, growAnchor)
    if (growAnchor && growPreview) this.preview(ctx, view, rules, growAnchor, growPreview)
  }

  private terrain(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    seed: string,
    terrain: TerrainConfig,
    rules: TreeRules,
  ) {
    const line = terrainPolyline(seed, terrain)
    ctx.fillStyle = rules.colorForeground
    ctx.beginPath()
    const first = view.worldToScreen(line[0]!.x, line[0]!.y)
    ctx.moveTo(first.x, first.y)
    for (let index = 1; index < line.length; index++) {
      const point = view.worldToScreen(line[index]!.x, line[index]!.y)
      ctx.lineTo(point.x, point.y)
    }
    const right = view.worldToScreen(rules.worldWidth, rules.worldHeight)
    const left = view.worldToScreen(0, rules.worldHeight)
    ctx.lineTo(right.x, right.y)
    ctx.lineTo(left.x, left.y)
    ctx.closePath()
    ctx.fill()
  }

  private branches(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    frame: TreeFrame,
    rules: TreeRules,
    seed: string,
    terrain: TerrainConfig,
  ) {
    const nodes = frame.nodes.filter((node) => !node.broken)
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const root = nodes.find((node) => node.parentId === null)
    ctx.strokeStyle = rules.colorForeground
    ctx.lineCap = 'round'
    if (root) {
      const groundY = terrainSurfaceY(root.x, seed, terrain)
      const foot = view.worldToScreen(root.x, groundY)
      const top = view.worldToScreen(root.x, root.y)
      ctx.lineWidth = Math.max(3, 5 * foot.scale)
      ctx.beginPath()
      ctx.moveTo(foot.x, foot.y)
      ctx.lineTo(top.x, top.y)
      ctx.stroke()
    }
    for (const node of nodes) {
      if (!node.parentId) continue
      const parent = byId.get(node.parentId)
      const start = node.attach ?? parent
      if (!start) continue
      const a = view.worldToScreen(start.x, start.y)
      const b = view.worldToScreen(node.x, node.y)
      ctx.lineWidth = Math.max(3, 5 * a.scale)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  }

  private exit(ctx: CanvasRenderingContext2D, view: SceneView, frame: TreeFrame, rules: TreeRules) {
    const exit = frame.exit
    const origin = view.worldToScreen(exit.x, exit.y)
    ctx.strokeStyle = rules.colorExitStroke
    ctx.lineWidth = 2
    ctx.strokeRect(origin.x, origin.y, exit.width * origin.scale, exit.height * origin.scale)
  }

  private firefly(ctx: CanvasRenderingContext2D, view: SceneView, frame: TreeFrame, rules: TreeRules) {
    if (!frame.fireflyPosition) return
    const fly = view.worldToScreen(frame.fireflyPosition.x, frame.fireflyPosition.y)
    ctx.fillStyle = rules.colorFireflyGlow
    ctx.beginPath()
    ctx.arc(fly.x, fly.y, 5 * fly.scale, 0, Math.PI * 2)
    ctx.fill()
  }

  private leaves(ctx: CanvasRenderingContext2D, view: SceneView, frame: TreeFrame, rules: TreeRules) {
    for (const node of frame.nodes.filter((item) => !item.broken && item.leaf)) {
      const point = view.worldToScreen(node.x, node.y)
      ctx.fillStyle = rules.colorForeground
      ctx.beginPath()
      ctx.arc(point.x, point.y - 6 * point.scale, 8 * point.scale, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private reach(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    frame: TreeFrame,
    rules: TreeRules,
    seed: string,
    terrain: TerrainConfig,
    growAnchor: GrowAnchor,
  ) {
    const nodes = frame.nodes.filter((node) => !node.broken)
    const boundary = reachBoundary(
      growAnchor.x,
      growAnchor.y,
      rules.lMax,
      ReachSegments.collect(nodes, seed, terrain),
      growAnchor.segmentId,
      rules.segmentBodyWidth / 2,
    )
    const outline = boundary.map((point) => view.worldToScreen(point.x, point.y))
    if (outline.length > 2) {
      ctx.beginPath()
      ctx.moveTo(outline[0]!.x, outline[0]!.y)
      for (let index = 1; index < outline.length; index++) ctx.lineTo(outline[index]!.x, outline[index]!.y)
      ctx.closePath()
      ctx.fillStyle = this.withAlpha(rules.colorForeground, 0.18)
      ctx.fill()
      ctx.strokeStyle = this.withAlpha(rules.colorForeground, 0.9)
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    const mark = view.worldToScreen(growAnchor.x, growAnchor.y)
    ctx.beginPath()
    ctx.arc(mark.x, mark.y, 4, 0, Math.PI * 2)
    ctx.stroke()
  }

  private preview(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    rules: TreeRules,
    growAnchor: GrowAnchor,
    growPreview: { x: number; y: number },
  ) {
    const a = view.worldToScreen(growAnchor.x, growAnchor.y)
    const b = view.worldToScreen(growPreview.x, growPreview.y)
    ctx.setLineDash([6, 6])
    ctx.strokeStyle = rules.colorForeground
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  private withAlpha(hex: string, alpha: number) {
    const raw = hex.replace('#', '')
    const full = raw.length === 3 ? raw.split('').map((channel) => channel + channel).join('') : raw
    const value = Number.parseInt(full, 16)
    const red = (value >> 16) & 255
    const green = (value >> 8) & 255
    const blue = value & 255
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`
  }
}
