/**
 * Returns a black-ink image tinted to `ink` via source-in.
 * Results are cached by image URL + ink + natural size.
 */
export function getTintedImage(
  image: HTMLImageElement,
  ink: string,
  cache: Map<string, HTMLCanvasElement>,
): HTMLCanvasElement | null {
  if (!image.complete || image.naturalWidth <= 0) return null
  const key = `${image.currentSrc}|${ink}|${image.naturalWidth}x${image.naturalHeight}`
  let tinted = cache.get(key)
  if (!tinted) {
    tinted = document.createElement('canvas')
    tinted.width = image.naturalWidth
    tinted.height = image.naturalHeight
    const tctx = tinted.getContext('2d')
    if (!tctx) return null
    tctx.drawImage(image, 0, 0)
    tctx.globalCompositeOperation = 'source-in'
    tctx.fillStyle = ink
    tctx.fillRect(0, 0, tinted.width, tinted.height)
    cache.set(key, tinted)
  }
  return tinted
}

/**
 * Draws a black-ink (or opaque) image tinted to `ink` via source-in.
 * Results are cached by image URL + ink + natural size.
 */
export function drawTintedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  ink: string,
  x: number,
  y: number,
  width: number,
  height: number,
  cache: Map<string, HTMLCanvasElement>,
) {
  if (!image) return
  const tinted = getTintedImage(image, ink, cache)
  if (!tinted) return
  ctx.drawImage(tinted, x, y, width, height)
}
