import type { Direction } from '../../model/frame.ts'

const ANGLES: Record<Direction, number> = {
  east: 0,
  south: Math.PI / 2,
  west: Math.PI,
  north: -Math.PI / 2,
}

/** Static “>” stroke pointing along `direction` (belt chevrons). */
export function drawFlowChevron(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: Direction,
  armPx: number,
  strokePx: number,
  color: string,
) {
  const angle = ANGLES[direction]
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(-armPx, -armPx * 0.85)
  ctx.lineTo(armPx * 0.35, 0)
  ctx.lineTo(-armPx, armPx * 0.85)
  ctx.strokeStyle = color
  ctx.lineWidth = strokePx
  ctx.stroke()
  ctx.restore()
}