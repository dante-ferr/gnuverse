import type { BeltRecord, PipelineFrame, PipelineRules, PacketShape } from '../../model/frame.ts'
import type { PacketMotionState } from '../packet-motion.ts'
import { packetDisplayCenter, packetSinkCenter } from '../packet-motion.ts'
import { cellSize } from './grid-painter.ts'

/** Packets are clipped to belt cells so they never paint over machines. */
export class PacketPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    belts: BeltRecord[],
    rules: PipelineRules,
    motion: PacketMotionState,
    timeMs: number,
  ) {
    const radius = cellSize * 0.22
    const drawDot = (px: number, py: number, shape: PacketShape) => {
      const fill = elementFill(rules, shape) ?? rules.colorPacket
      ctx.beginPath()
      ctx.fillStyle = fill
      ctx.arc(px, py, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = rules.colorOutline
      ctx.lineWidth = rules.outlineWidthPx
      ctx.stroke()
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
          const drew = this.drawElementGlyph(ctx, packet.shape, rules, px, py)
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
  ) {
    const el = rules.elements.elements.find((item) => item.id === shape)
    if (!el?.glyph) return false
    const src = el.glyph.startsWith('/') ? el.glyph : `/${el.glyph}`
    const image = (globalThis as { __packetGlyphs?: Record<string, HTMLImageElement> }).__packetGlyphs?.[src]
    if (!image?.complete || image.naturalWidth <= 0) return false
    const size = el.glyph_size_px ?? rules.resourceGlyphSizePx
    ctx.drawImage(image, px - size / 2, py - size / 2, size, size)
    return true
  }
}

function elementFill(rules: PipelineRules, shape: PacketShape) {
  if (shape === 'circle') return rules.colorPacket
  return rules.elements.elements.find((item) => item.id === shape)?.fill ?? rules.colorPacket
}