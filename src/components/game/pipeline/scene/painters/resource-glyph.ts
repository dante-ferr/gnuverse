import type { PipelineRules, ResourceGlyphOutlineMode } from '../../model/frame.ts'
import { getTintedImage } from './tint-image.ts'

/** Outline presentation from `[pipeline]` resource_glyph_outline_* keys. */
export type ResourceGlyphOutline = {
  mode: ResourceGlyphOutlineMode
  outer: string
  inner: string
  /** Soft halo color when `mode` is `blur`. */
  blur: string
  outerWidthPx: number
  innerWidthPx: number
  /** Multiplier for silhouette offset distance. */
  spread: number
}

/** Outline style from `[pipeline]` resource_glyph_outline_* keys. */
export function resourceGlyphOutline(rules: PipelineRules): ResourceGlyphOutline {
  return {
    mode: rules.resourceGlyphOutlineMode,
    outer: rules.resourceGlyphOutlineOuter,
    inner: rules.resourceGlyphOutlineInner,
    blur: rules.resourceGlyphOutlineBlur,
    outerWidthPx: rules.resourceGlyphOutlineOuterWidthPx,
    innerWidthPx: rules.resourceGlyphOutlineInnerWidthPx,
    spread: rules.resourceGlyphOutlineSpread,
  }
}

/**
 * Draws a catalog SVG glyph with the configured outline mode.
 * Bakes outline + fill into one cached canvas, then draws once.
 * Diameter is `size` with no machine-footprint clamp.
 */
export function drawOutlinedResourceGlyph(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  fill: string,
  cx: number,
  cy: number,
  size: number,
  outline: ResourceGlyphOutline,
  cache: Map<string, HTMLCanvasElement>,
) {
  if (!image || !image.complete || image.naturalWidth <= 0 || size <= 0) return
  const baked = getOutlinedGlyph(image, fill, size, outline, cache)
  if (!baked) return
  const rect = snapSpriteRect(
    ctx,
    cx - baked.displaySize / 2,
    cy - baked.displaySize / 2,
    baked.displaySize,
    baked.displaySize,
  )
  if (rect.w < 0.01 || rect.h < 0.01) return
  ctx.drawImage(baked.canvas, rect.x, rect.y, rect.w, rect.h)
}

/**
 * Snap a sprite's top-left to a device pixel and keep its size constant.
 * Rounding both edges makes the width flicker by one pixel as the sprite moves.
 */
export function snapSpriteRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const t = ctx.getTransform()
  if (!axisScale(t.a) || !axisScale(t.d)) return { x, y, w, h }
  const snappedW = Math.max(1, Math.round(w * t.a))
  const snappedH = Math.max(1, Math.round(h * t.d))
  const x0 = Math.round(x * t.a + t.e)
  const y0 = Math.round(y * t.d + t.f)
  return {
    x: (x0 - t.e) / t.a,
    y: (y0 - t.f) / t.d,
    w: snappedW / t.a,
    h: snappedH / t.d,
  }
}

/**
 * Snap a tile so shared edges meet. Floor both sides so neighboring belt cells
 * neither gap nor overlap after the camera transform.
 */
export function snapTileRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const t = ctx.getTransform()
  if (!axisScale(t.a) || !axisScale(t.d)) return { x, y, w, h }
  const x0 = Math.floor(x * t.a + t.e)
  const y0 = Math.floor(y * t.d + t.f)
  const x1 = Math.floor((x + w) * t.a + t.e)
  const y1 = Math.floor((y + h) * t.d + t.f)
  return {
    x: (x0 - t.e) / t.a,
    y: (y0 - t.f) / t.d,
    w: (x1 - x0) / t.a,
    h: (y1 - y0) / t.d,
  }
}

function axisScale(scale: number) {
  return Number.isFinite(scale) && Math.abs(scale) >= 1e-6
}

function snapDevice(value: number, scale: number, origin: number) {
  if (!axisScale(scale)) return value
  return (Math.round(value * scale + origin) - origin) / scale
}

function snapWorldPoint(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const t = ctx.getTransform()
  return { x: snapDevice(x, t.a, t.e), y: snapDevice(y, t.d, t.f) }
}

/**
 * Draws a filled disk with the same outline mode as catalog glyphs.
 * Used for legacy `circle` packets and glyph fallbacks.
 */
export function drawOutlinedResourceDisk(
  ctx: CanvasRenderingContext2D,
  fill: string,
  cx: number,
  cy: number,
  radius: number,
  outline: ResourceGlyphOutline,
) {
  const snapped = snapWorldPoint(ctx, cx, cy)
  cx = snapped.x
  cy = snapped.y
  const black = Math.max(0, outline.innerWidthPx)
  const white = Math.max(0, outline.outerWidthPx)
  const spread = Math.max(0.5, outline.spread)

  if (outline.mode === 'blur') {
    const outerR = white > 0 ? Math.max(white * spread, radius * 0.08) : 0
    const innerR = black > 0 ? Math.max(black * spread, radius * 0.08) : 0
    const glowR = Math.max(outerR, innerR)
    if (glowR > 0) {
      ctx.save()
      ctx.shadowColor = outline.blur
      ctx.shadowBlur = glowR
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fillStyle = outline.blur
      ctx.fill()
      ctx.restore()
    }
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
    return
  }

  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()

  if (outline.mode === 'single') {
    const width = black > 0 ? black : white
    const color = black > 0 ? outline.inner : outline.outer
    if (width > 0) {
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.stroke()
    }
    return
  }

  if (white + black > 0) {
    ctx.strokeStyle = outline.outer
    ctx.lineWidth = white + black
    ctx.stroke()
  }
  if (black > 0) {
    ctx.strokeStyle = outline.inner
    ctx.lineWidth = black
    ctx.stroke()
  }
}

function ringRadii(outline: ResourceGlyphOutline, size: number) {
  const spread = Math.max(0.5, outline.spread)
  const innerRing = outline.innerWidthPx > 0 ? Math.max(outline.innerWidthPx * spread, size * 0.02) : 0
  const outerExtra = outline.outerWidthPx > 0 ? Math.max(outline.outerWidthPx * spread, size * 0.02) : 0
  if (outline.mode === 'single' || outline.mode === 'blur') {
    const single = Math.max(innerRing, outerExtra)
    return { innerRing: single, outerRing: single }
  }
  return { innerRing, outerRing: innerRing + outerExtra }
}

function getOutlinedGlyph(
  image: HTMLImageElement,
  fill: string,
  size: number,
  outline: ResourceGlyphOutline,
  cache: Map<string, HTMLCanvasElement>,
): { canvas: HTMLCanvasElement; displaySize: number } | null {
  const { innerRing, outerRing } = ringRadii(outline, size)
  const displayPad = Math.ceil(Math.max(outerRing, innerRing)) + 1
  const displaySize = size + displayPad * 2
  const key = [
    'outlined',
    outline.mode,
    image.currentSrc,
    fill,
    outline.outer,
    outline.inner,
    outline.blur,
    outline.outerWidthPx,
    outline.innerWidthPx,
    outline.spread,
    size,
    `${image.naturalWidth}x${image.naturalHeight}`,
  ].join('|')
  let canvas = cache.get(key)
  if (!canvas) {
    const mul = size >= 96 ? 2 : 3
    const bakeSize = Math.max(1, Math.round(size * mul))
    const bakeOuter = outerRing * mul
    const bakeInner = innerRing * mul
    const bakePad = Math.ceil(Math.max(bakeOuter, bakeInner)) + 1
    const bakeDim = bakeSize + bakePad * 2

    const body = getTintedImage(image, fill, cache)
    if (!body) return null

    canvas = document.createElement('canvas')
    canvas.width = bakeDim
    canvas.height = bakeDim
    const tctx = canvas.getContext('2d')
    if (!tctx) return null

    if (outline.mode === 'blur') {
      const radius = Math.max(bakeInner, bakeOuter)
      if (radius > 0) {
        paintBlurredOutline(tctx, image, bakePad, bakeSize, radius, outline.blur)
      }
    } else if (outline.mode === 'single') {
      const color = outline.innerWidthPx > 0 ? outline.inner : outline.outer
      const radius = bakeInner > 0 ? bakeInner : bakeOuter
      if (radius > 0) {
        const tinted = getTintedImage(image, color, cache)
        if (tinted) {
          stampDisk(tctx, tinted, bakePad, bakeSize, radius)
          hardenAlpha(tctx)
        }
      }
    } else {
      if (bakeOuter > 0 && outline.outerWidthPx > 0) {
        const outer = getTintedImage(image, outline.outer, cache)
        if (outer) {
          stampDisk(tctx, outer, bakePad, bakeSize, bakeOuter)
          hardenAlpha(tctx)
        }
      }
      if (bakeInner > 0 && outline.innerWidthPx > 0) {
        const inner = getTintedImage(image, outline.inner, cache)
        if (inner) {
          stampDisk(tctx, inner, bakePad, bakeSize, bakeInner)
          hardenAlpha(tctx)
        }
      }
    }
    tctx.drawImage(body, bakePad, bakePad, bakeSize, bakeSize)

    cache.set(key, canvas)
  }
  return { canvas, displaySize }
}

function stampDisk(
  ctx: CanvasRenderingContext2D,
  tinted: HTMLCanvasElement,
  pad: number,
  size: number,
  radius: number,
) {
  if (radius <= 0) return
  const rings = Math.max(1, Math.ceil(radius))
  for (let ring = 1; ring <= rings; ring++) {
    const t = ring / rings
    const r = radius * t
    const samples = Math.min(128, Math.max(8, Math.ceil(2 * Math.PI * r)))
    for (let i = 0; i < samples; i++) {
      const a = (2 * Math.PI * i) / samples
      ctx.drawImage(tinted, pad + Math.cos(a) * r, pad + Math.sin(a) * r, size, size)
    }
  }
}

/** Soft silhouette expansion (cached). Uses `resource_glyph_outline_blur`. */
function paintBlurredOutline(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  pad: number,
  size: number,
  radius: number,
  color: string,
) {
  if (radius <= 0) return
  const dim = size + pad * 2

  const sil = document.createElement('canvas')
  sil.width = dim
  sil.height = dim
  const s = sil.getContext('2d')
  if (!s) return
  s.drawImage(image, pad, pad, size, size)
  s.globalCompositeOperation = 'source-in'
  s.fillStyle = '#ffffff'
  s.fillRect(0, 0, dim, dim)
  s.globalCompositeOperation = 'source-over'

  const expanded = document.createElement('canvas')
  expanded.width = dim
  expanded.height = dim
  const e = expanded.getContext('2d')
  if (!e) return
  e.filter = `blur(${Math.max(0.5, radius * 0.55)}px)`
  e.drawImage(sil, 0, 0)
  e.filter = 'none'

  const pixels = e.getImageData(0, 0, dim, dim)
  const data = pixels.data
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!
    if (a < 16) {
      data[i + 3] = 0
      continue
    }
    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
    data[i + 3] = a < 140 ? Math.round((a / 140) * 255) : 255
  }
  e.putImageData(pixels, 0, 0)

  e.globalCompositeOperation = 'source-in'
  e.fillStyle = color
  e.fillRect(0, 0, dim, dim)

  ctx.drawImage(expanded, 0, 0)
}

function hardenAlpha(ctx: CanvasRenderingContext2D) {
  const { width, height } = ctx.canvas
  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data
  for (let i = 3; i < data.length; i += 4) {
    data[i] = data[i]! > 0 ? 255 : 0
  }
  ctx.putImageData(image, 0, 0)
}
