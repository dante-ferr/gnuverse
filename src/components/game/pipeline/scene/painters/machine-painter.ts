import { CoreMachine } from '../../../../../../game-server/pipeline/machines/core-machine.ts'
import { SourceMachine } from '../../../../../../game-server/pipeline/machines/source-machine.ts'
import type { Machine } from '../../../../../../game-server/pipeline/machines/machine.ts'
import type { PacketShape } from '../../../../../../game-server/pipeline/packets/packet.ts'
import type { PipelineFrame, PipelineRules } from '../../model/frame.ts'
import { cellSize } from './grid-painter.ts'

/** Shape → resource glyph under /public/pipeline/. Sources must show this clearly. */
const resourceDecorSrc: Record<PacketShape, string> = {
  circle: '/pipeline/resource-circle.svg',
}

export type MachineDecorImages = {
  core: HTMLImageElement | null
  resources: Partial<Record<PacketShape, HTMLImageElement | null>>
}

/** Draws machine bodies (cell-fit rects), “[” slots, decor SVGs, and packets. */
export class MachinePainter {
  constructor(private readonly images: MachineDecorImages) {}

  draw(ctx: CanvasRenderingContext2D, frame: PipelineFrame, rules: PipelineRules) {
    const core = new CoreMachine(frame.core.id, { x: frame.core.x, y: frame.core.y })
    const source = new SourceMachine(
      frame.source.id,
      { x: frame.source.x, y: frame.source.y },
      frame.source.direction,
      frame.source.shape,
      1,
    )
    this.machine(ctx, core, rules.colorCore, this.images.core)
    if (!(frame.source.shape in resourceDecorSrc))
      throw new Error(`Source has no resource SVG for shape "${frame.source.shape}"`)
    this.machine(
      ctx,
      source,
      rules.colorSource,
      this.images.resources[frame.source.shape] ?? null,
    )
    for (const packet of frame.packets) {
      ctx.beginPath()
      ctx.fillStyle = rules.colorPacket
      ctx.arc(
        (packet.x + 0.5) * cellSize,
        (packet.y + 0.5) * cellSize,
        cellSize * 0.22,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }

  private machine(
    ctx: CanvasRenderingContext2D,
    machine: Machine,
    color: string,
    decor: HTMLImageElement | null,
  ) {
    const px = machine.origin.x * cellSize
    const py = machine.origin.y * cellSize
    const width = machine.width * cellSize
    const height = machine.height * cellSize
    ctx.fillStyle = color
    ctx.fillRect(px, py, width, height)
    for (const slot of machine.slots) {
      const path = machine.slotBracket(slot, cellSize)
      ctx.beginPath()
      ctx.moveTo(path[0]!.x, path[0]!.y)
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i]!.x, path[i]!.y)
      ctx.closePath()
      ctx.fill()
    }
    drawDecor(ctx, decor, px, py, width, height)
  }
}

/** Prefetch core decor and every known resource glyph. */
export function loadMachineDecor(onLoad: () => void): MachineDecorImages {
  const core = new Image()
  core.src = '/pipeline/core-decor.svg'
  core.onload = onLoad
  const resources: MachineDecorImages['resources'] = {}
  for (const [shape, src] of Object.entries(resourceDecorSrc) as [PacketShape, string][]) {
    const image = new Image()
    image.src = src
    image.onload = onLoad
    resources[shape] = image
  }
  return { core, resources }
}

function drawDecor(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!image || !image.complete || image.naturalWidth <= 0) return
  ctx.drawImage(image, x, y, width, height)
}
