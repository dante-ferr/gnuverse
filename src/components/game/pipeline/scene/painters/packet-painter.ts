import type { BeltRecord, PipelineFrame, PipelineRules, PacketShape } from '../../model/frame.ts'
import type { PacketMotionState } from '../packet-motion.ts'
import { packetClipCells, packetDisplayCenter, packetSinkCenter } from '../packet-motion.ts'
import type { SceneLod } from '../scene-lod.ts'
import { cellSize } from './grid-painter.ts'
import { elementFill } from './element-fill.ts'
import {
  drawOutlinedResourceDisk,
  drawOutlinedResourceGlyph,
  resourceGlyphOutline,
  type ResourceGlyphOutline,
} from './resource-glyph.ts'

/** Packets are clipped to belt cells so they never paint over machines. */
export class PacketPainter {
  private resourceGlyphs: Record<string, HTMLImageElement | null> = {}
  private readonly tintCache = new Map<string, HTMLCanvasElement>()

  setResourceGlyphs(glyphs: Record<string, HTMLImageElement | null>) {
    this.resourceGlyphs = glyphs
  }

  draw(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    belts: BeltRecord[],
    rules: PipelineRules,
    motion: PacketMotionState,
    timeMs: number,
    lod: SceneLod = { packetGlyphs: true, beltChevrons: true, machines: 'full' },
  ) {
    const radius = cellSize * (lod.packetGlyphs ? 0.22 : 0.2)
    const outline = resourceGlyphOutline(rules)
    const lodOutline: ResourceGlyphOutline = lod.packetGlyphs
      ? outline
      : {
          ...outline,
          outerWidthPx: Math.min(outline.outerWidthPx, 1.5),
          innerWidthPx: Math.min(outline.innerWidthPx, 1),
        }
    const clipPackets = lod.packetGlyphs
    const drawPacket = (px: number, py: number, shape: PacketShape) => {
      if (
        lod.packetGlyphs &&
        shape !== 'circle' &&
        this.drawElementGlyph(ctx, shape, rules, px, py, outline)
      ) {
        return
      }
      const fill = elementFill(rules, shape) ?? rules.colorPacket
      drawOutlinedResourceDisk(ctx, fill, px, py, radius, lodOutline)
    }

    if (frame.packets.length > 0 && belts.length > 0) {
      for (const packet of frame.packets) {
        const { px, py } = packetDisplayCenter(packet, frame, rules, motion, timeMs, cellSize)
        if (!clipPackets) {
          drawPacket(px, py, packet.shape)
          continue
        }
        const cells = packetClipCells(packet, motion)
        ctx.save()
        ctx.beginPath()
        for (const cell of cells) ctx.rect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize)
        ctx.clip()
        drawPacket(px, py, packet.shape)
        ctx.restore()
      }
    }

    for (const sink of motion.sinks) {
      const { px, py } = packetSinkCenter(sink, rules, timeMs)
      drawPacket(px, py, sink.shape)
    }
  }

  private drawElementGlyph(
    ctx: CanvasRenderingContext2D,
    shape: PacketShape,
    rules: PipelineRules,
    px: number,
    py: number,
    outline: ResourceGlyphOutline,
  ) {
    const el = rules.elements.elements.find((item) => item.id === shape)
    if (!el?.glyph) return false
    const image = this.resourceGlyphs[shape]
    if (!image?.complete || image.naturalWidth <= 0) return false
    const size = el.glyph_size_px ?? rules.resourceGlyphSizePx
    const fill = el.fill || rules.colorPacket
    drawOutlinedResourceGlyph(ctx, image, fill, px, py, size, outline, this.tintCache)
    return true
  }
}
