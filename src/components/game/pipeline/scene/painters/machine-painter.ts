import { CoreMachine } from '../../../../../../game-server/pipeline/machines/core-machine.ts'
import {
  slotBracketStyleFromRules,
  type SlotBracketStyle,
} from '../../../../../../game-server/pipeline/machines/machine.ts'
import { SourceMachine } from '../../../../../../game-server/pipeline/machines/source-machine.ts'
import type { Machine } from '../../../../../../game-server/pipeline/machines/machine.ts'
import type { PacketShape } from '../../../../../../game-server/pipeline/packets/packet.ts'
import type { PipelineFrame, PipelineRules } from '../../model/frame.ts'
import { darkenHex } from './darken-hex.ts'
import { cellSize } from './grid-painter.ts'

/** Shape → resource glyph under /public/pipeline/ (optional fallback). */
const resourceDecorSrc: Record<PacketShape, string> = {
  circle: '/pipeline/resource-circle.svg',
}

export type MachineDecorImages = {
  core: HTMLImageElement | null
  source: HTMLImageElement | null
  resources: Partial<Record<PacketShape, HTMLImageElement | null>>
}

/** Draws machine bodies (cell-fit rects), “[” slots, tinted decor SVGs, and orbiting glyphs. */
export class MachinePainter {
  private readonly tintCache = new Map<string, HTMLCanvasElement>()

  constructor(private readonly images: MachineDecorImages) {}

  draw(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    rules: PipelineRules,
    cameraZoom: number,
    timeMs: number,
  ) {
    const core = new CoreMachine(frame.core.id, { x: frame.core.x, y: frame.core.y })
    const source = new SourceMachine(
      frame.source.id,
      { x: frame.source.x, y: frame.source.y },
      frame.source.direction,
      frame.source.shape,
      1,
    )
    const bracketStyle = slotBracketStyleFromRules(rules)
    this.machine(ctx, core, rules.colorCore, this.images.core, rules, bracketStyle)
    this.machine(ctx, source, rules.colorSource, this.images.source, rules, bracketStyle)
    this.drawOrbitingResourceGlyph(ctx, source, frame.source.shape, rules, cameraZoom, timeMs)
  }

  private machine(
    ctx: CanvasRenderingContext2D,
    machine: Machine,
    bodyColor: string,
    decor: HTMLImageElement | null,
    rules: PipelineRules,
    bracketStyle: SlotBracketStyle,
  ) {
    const px = machine.origin.x * cellSize
    const py = machine.origin.y * cellSize
    const width = machine.width * cellSize
    const height = machine.height * cellSize
    ctx.fillStyle = bodyColor
    ctx.fillRect(px, py, width, height)
    ctx.strokeStyle = rules.colorOutline
    ctx.lineWidth = rules.outlineWidthPx
    ctx.strokeRect(px, py, width, height)
    for (const slot of machine.slots) {
      const path = machine.slotBracket(slot, cellSize, bracketStyle)
      ctx.beginPath()
      ctx.moveTo(path[0]!.x, path[0]!.y)
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i]!.x, path[i]!.y)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    const decorInk = darkenHex(bodyColor, rules.decorDarkenPercent)
    drawTintedDecor(ctx, decor, decorInk, px, py, width, height, this.tintCache)
  }

  private drawOrbitingResourceGlyph(
    ctx: CanvasRenderingContext2D,
    machine: Machine,
    shape: PacketShape,
    rules: PipelineRules,
    cameraZoom: number,
    timeMs: number,
  ) {
    const worldCx = (machine.origin.x + machine.width / 2) * cellSize
    const worldCy = (machine.origin.y + machine.height / 2) * cellSize
    const angle = (2 * Math.PI * timeMs) / rules.resourceGlyphOrbitMs
    const ox = Math.cos(angle) * rules.resourceGlyphOrbitPx
    const oy = Math.sin(angle) * rules.resourceGlyphOrbitPx
    const zoom = cameraZoom > 0 ? cameraZoom : 1
    ctx.save()
    ctx.translate(worldCx, worldCy)
    ctx.scale(1 / zoom, 1 / zoom)
    ctx.translate(ox, oy)
    this.drawResourceGlyph(ctx, shape, rules)
    ctx.restore()
  }

  private drawResourceGlyph(ctx: CanvasRenderingContext2D, shape: PacketShape, rules: PipelineRules) {
    const size = rules.resourceGlyphSizePx
    const image = this.images.resources[shape]
    if (shape === 'circle') {
      // Single filled disk + dark outline only (no inner rings or nested circles).
      const radius = size / 2
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = rules.colorOutline
      ctx.lineWidth = rules.outlineWidthPx
      ctx.stroke()
      return
    }
    if (image?.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, -size / 2, -size / 2, size, size)
    }
  }
}

/** Prefetch core and source decor; resource glyphs are optional fallbacks. */
export function loadMachineDecor(onLoad: () => void): MachineDecorImages {
  const core = new Image()
  core.src = '/pipeline/core-decor.svg'
  core.onload = onLoad
  const source = new Image()
  source.src = '/pipeline/source-decor.svg'
  source.onload = onLoad
  const resources: MachineDecorImages['resources'] = {}
  for (const [shape, src] of Object.entries(resourceDecorSrc) as [PacketShape, string][]) {
    const image = new Image()
    image.src = src
    image.onload = onLoad
    resources[shape] = image
  }
  return { core, source, resources }
}

function drawTintedDecor(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  ink: string,
  x: number,
  y: number,
  width: number,
  height: number,
  cache: Map<string, HTMLCanvasElement>,
) {
  if (!image || !image.complete || image.naturalWidth <= 0) return
  const key = `${image.currentSrc}|${ink}|${image.naturalWidth}x${image.naturalHeight}`
  let tinted = cache.get(key)
  if (!tinted) {
    tinted = document.createElement('canvas')
    tinted.width = image.naturalWidth
    tinted.height = image.naturalHeight
    const tctx = tinted.getContext('2d')
    if (!tctx) return
    tctx.drawImage(image, 0, 0)
    tctx.globalCompositeOperation = 'source-in'
    tctx.fillStyle = ink
    tctx.fillRect(0, 0, tinted.width, tinted.height)
    cache.set(key, tinted)
  }
  ctx.drawImage(tinted, x, y, width, height)
}