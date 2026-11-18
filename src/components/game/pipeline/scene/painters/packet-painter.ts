import type { BeltRecord, PipelineFrame, PipelineRules } from '../../model/frame.ts'
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
    const drawDot = (px: number, py: number) => {
      ctx.beginPath()
      ctx.fillStyle = rules.colorPacket
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
        drawDot(px, py)
      }
      ctx.restore()
    }

    for (const sink of motion.sinks) {
      const { px, py } = packetSinkCenter(sink, rules, timeMs)
      drawDot(px, py)
    }
  }
}