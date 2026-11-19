import type { PipelineRules } from '../../model/frame.ts'
import { getTintedImage } from './tint-image.ts'

/** Dual outline for element glyphs and belt packets: outer then inner. */
export type ResourceGlyphOutline = {
  outer: string
  inner: string
  outerWidthPx: number
  innerWidthPx: number
  /** Multiplier for silhouette offset distance. */
  spread: number
}

/** Outline style from `[pipeline]` resource_glyph_outline_* keys. */
export function resourceGlyphOutline(rules: PipelineRules): ResourceGlyphOutline {
  return {
    outer: rules.resourceGlyphOutlineOuter,
    inner: rules.resourceGlyphOutlineInner,
    outerWidthPx: rules.resourceGlyphOutlineOuterWidthPx,
    innerWidthPx: rules.resourceGlyphOutlineInnerWidthPx,
    spread: rules.resourceGlyphOutlineSpread,
  }
}

/**
 * Draws a catalog SVG glyph with a dual outline.
 * Bakes outer + inner + fill into one cached canvas, then draws once.
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
  ctx.drawImage(
    baked.canvas,
    cx - baked.displaySize / 2,
    cy - baked.displaySize / 2,
    baked.displaySize,
    baked.displaySize,
  )
}

/**
 * Draws a filled disk with the same dual outline (outer then inner).
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
  const black = Math.max(0, outline.innerWidthPx)
  const white = Math.max(0, outline.outerWidthPx)
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  // Canvas strokes are centered on the path: draw outer first (thicker), then inner.
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
  const outerRing = innerRing + outerExtra
  return { innerRing, outerRing }
}

function getOutlinedGlyph(
  image: HTMLImageElement,
  fill: string,
  size: number,
  outline: ResourceGlyphOutline,
  cache: Map<string, HTMLCanvasElement>,
): { canvas: HTMLCanvasElement; displaySize: number } | null {
  const { innerRing, outerRing } = ringRadii(outline, size)
  const displayPad = Math.ceil(outerRing) + 1
  const displaySize = size + displayPad * 2
  const key = [
    'outlined',
    image.currentSrc,
    fill,
    outline.outer,
    outline.inner,
    outline.outerWidthPx,
    outline.innerWidthPx,
    outline.spread,
    size,
    `${image.naturalWidth}x${image.naturalHeight}`,
  ].join('|')
  let canvas = cache.get(key)
  if (!canvas) {
    const nw = image.naturalWidth
    const nh = image.naturalHeight
    const scale = nw / size
    const pad = Math.ceil(outerRing * scale) + 1
    const body = getTintedImage(image, fill, cache)
    if (!body) return null

    // Bake at native SVG resolution, then scale down once when drawing.
    // Display-size bakes looked soft; stamp density still follows screen px.
    canvas = document.createElement('canvas')
    canvas.width = nw + pad * 2
    canvas.height = nh + pad * 2
    const tctx = canvas.getContext('2d')
    if (!tctx) return null

    if (outerRing > 0) {
      const outer = getTintedImage(image, outline.outer, cache)
      if (outer) {
        stampDisk(tctx, outer, pad, nw, nh, outerRing * scale, outerRing)
        hardenAlpha(tctx)
      }
    }
    if (innerRing > 0) {
      const inner = getTintedImage(image, outline.inner, cache)
      if (inner) {
        stampDisk(tctx, inner, pad, nw, nh, innerRing * scale, innerRing)
        hardenAlpha(tctx)
      }
    }
    tctx.drawImage(body, pad, pad)

    cache.set(key, canvas)
  }
  return { canvas, displaySize }
}

/**
 * Morphological dilation of a (possibly stroke-only) glyph alpha.
 *
 * Element SVGs are black-ink strokes, not filled silhouettes. Stamping only the
 * outer circumference leaves ghost copies when the outline is thick. Concentric
 * rings fill a solid halo. Ring/sample counts follow display px so native-res
 * bakes stay affordable and look continuous after downscale.
 */
function stampDisk(
  ctx: CanvasRenderingContext2D,
  tinted: HTMLCanvasElement,
  pad: number,
  width: number,
  height: number,
  canvasRadius: number,
  displayRadius: number,
) {
  if (canvasRadius <= 0 || displayRadius <= 0) return
  const rings = Math.max(1, Math.ceil(displayRadius))
  for (let ring = 1; ring <= rings; ring++) {
    const t = ring / rings
    const r = canvasRadius * t
    const samples = Math.min(64, Math.max(8, Math.ceil(2 * Math.PI * displayRadius * t)))
    for (let i = 0; i < samples; i++) {
      const a = (2 * Math.PI * i) / samples
      const ox = Math.cos(a) * r
      const oy = Math.sin(a) * r
      ctx.drawImage(tinted, pad + ox, pad + oy, width, height)
    }
  }
}

/** Snap outline coverage to binary alpha so downscale AA stays crisp, not muddy. */
function hardenAlpha(ctx: CanvasRenderingContext2D) {
  const { width, height } = ctx.canvas
  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data
  for (let i = 3; i < data.length; i += 4) {
    data[i] = data[i] > 0 ? 255 : 0
  }
  ctx.putImageData(image, 0, 0)
}
