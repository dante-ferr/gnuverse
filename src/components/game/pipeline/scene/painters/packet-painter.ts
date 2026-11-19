import type { BeltRecord, PipelineFrame, PipelineRules, PacketShape } from '../../model/frame.ts'
import type { PacketMotionState } from '../packet-motion.ts'
import { packetDisplayCenter, packetSinkCenter } from '../packet-motion.ts'
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
  ) {
    const radius = cellSize * 0.22
    const outline = resourceGlyphOutline(rules)
    const drawDot = (px: number, py: number, shape: PacketShape) => {
      const fill = elementFill(rules, shape) ?? rules.colorPacket
      drawOutlinedResourceDisk(ctx, fill, px, py, radius, outline)
    }

    if (frame.packets.length > 0 && belts.length > 0) {
      ctx.save()
      ctx.beginPath()
      for (const belt of belts) {
        ctx.rect(belt.x * cellSize, belt.y * cellSize, cellSize, cellSize)
      }
      ctx.clip()
      for (const packet of frame.packets) {
        const { px, py } = packetDisplayCenter(packet, frame, rules, motion, timeMs, cellSize)
        if (packet.shape !== 'circle') {
          const drew = this.drawElementGlyph(ctx, packet.shape, rules, px, py, outline)
          if (drew) continue
        }
        drawDot(px, py, packet.shape)
      }
      ctx.restore()
    }

    for (const sink of motion.sinks) {
      const { px, py } = packetSinkCenter(sink, rules, timeMs)
      drawDot(px, py, sink.shape)
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
