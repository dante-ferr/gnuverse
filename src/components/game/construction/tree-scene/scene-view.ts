import type { TreeRules } from '../../../../../game-server/config/load-game-config.ts'

export type GameCamera = { x: number; y: number; zoom: number }

export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 4
export const ZOOM_STEP = 1.12

/** Projeção da câmera sobre o canvas, com zoom limitado ao mundo. */
export class SceneView {
  width: number
  height: number
  rules: TreeRules
  camera: GameCamera

  constructor(width: number, height: number, rules: TreeRules, camera: GameCamera) {
    this.width = width
    this.height = height
    this.rules = rules
    this.camera = camera
  }

  baseScale() {
    return Math.min(this.width / this.rules.worldWidth, this.height / this.rules.worldHeight)
  }

  scale() {
    return this.baseScale() * this.camera.zoom
  }

  origin(scale: number) {
    return {
      ox: (this.width - this.rules.worldWidth * scale) / 2,
      oy: (this.height - this.rules.worldHeight * scale) / 2,
    }
  }

  clampZoom(zoom: number) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
  }

  clamp(x: number, y: number, zoom: number): GameCamera {
    const scale = this.baseScale() * zoom
    const { ox, oy } = this.origin(scale)
    const viewW = this.width / scale
    const viewH = this.height / scale
    const edgeX = ox / scale
    let cx = x
    let cy = y
    if (viewW >= this.rules.worldWidth) {
      cx = this.rules.worldWidth / 2 - (this.width / 2 - ox) / scale
    } else {
      cx = Math.min(this.rules.worldWidth - viewW + edgeX, Math.max(edgeX, x))
    }
    if (viewH >= this.rules.worldHeight) {
      cy = this.rules.worldHeight / 2 - (this.height / 2 - oy) / scale
    } else {
      const minY = oy / scale
      cy = Math.min(this.rules.worldHeight - viewH + minY, Math.max(minY, y))
    }
    return { x: cx, y: cy, zoom }
  }

  worldToScreen(wx: number, wy: number) {
    const scale = this.scale()
    const { ox, oy } = this.origin(scale)
    return {
      x: ox + (wx - this.camera.x) * scale,
      y: oy + (wy - this.camera.y) * scale,
      scale,
      ox,
      oy,
    }
  }

  screenToWorld(sx: number, sy: number) {
    const scale = this.scale()
    const { ox, oy } = this.origin(scale)
    return {
      x: (sx - ox) / scale + this.camera.x,
      y: (sy - oy) / scale + this.camera.y,
    }
  }

  zoomed(sx: number, sy: number, nextZoom: number): GameCamera {
    const world = this.screenToWorld(sx, sy)
    const scale = this.baseScale() * nextZoom
    const { ox, oy } = this.origin(scale)
    return this.clamp(
      world.x - (sx - ox) / scale,
      world.y - (sy - oy) / scale,
      nextZoom,
    )
  }
}
