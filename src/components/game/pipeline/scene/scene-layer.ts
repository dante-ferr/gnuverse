export type SceneLayer = {
  canvas: HTMLCanvasElement
  key: string
  width: number
  height: number
}

/**
 * Screen-sized bitmap of world content that does not change every animation frame.
 * The key includes camera, view size, and a layout hash. A hit returns the previous canvas.
 */
export function paintSceneLayer(
  layer: SceneLayer | null,
  key: string,
  cssWidth: number,
  cssHeight: number,
  ratio: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): SceneLayer {
  const width = Math.max(1, Math.floor(cssWidth * ratio))
  const height = Math.max(1, Math.floor(cssHeight * ratio))
  const current = layer ?? {
    canvas: document.createElement('canvas'),
    key: '',
    width: 0,
    height: 0,
  }
  if (current.key === key && current.width === width && current.height === height) return current
  const canvas = current.canvas
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return current
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, cssWidth, cssHeight)
  draw(ctx)
  current.key = key
  current.width = width
  current.height = height
  return current
}
