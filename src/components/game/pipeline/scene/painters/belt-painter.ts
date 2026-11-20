import type { BeltRecord, Direction, PipelineRules } from '../../model/frame.ts'
import { ahead } from '../grid-math.ts'
import { drawFlowChevron } from './flow-chevron.ts'
import { cellSize } from './grid-painter.ts'

type Point = { x: number; y: number }

/**
 * Draws each belt cell as a straight square-ended track along its own
 * direction (no adjacency-based corner bends), with chevrons clipped to that cell.
 */
export class BeltPainter {
  draw(ctx: CanvasRenderingContext2D, belts: BeltRecord[], rules: PipelineRules, timeMs: number) {
    this.drawTracks(ctx, belts, rules)
    this.drawChevrons(ctx, belts, rules, timeMs)
  }

  /** Static track and fast-belt rails. Safe to cache; chevrons are not included. */
  drawTracks(ctx: CanvasRenderingContext2D, belts: BeltRecord[], rules: PipelineRules) {
    const beltWidth = cellSize * 0.88
    const normal: BeltRecord[] = []
    const fast: BeltRecord[] = []
    for (const belt of belts) {
      if (isFastBelt(belt, rules)) fast.push(belt)
      else normal.push(belt)
    }
    strokeTracks(ctx, normal, rules.colorBelt, beltWidth)
    strokeTracks(ctx, fast, rules.colorFastBelt, beltWidth)
    for (const belt of fast) {
      const behind = ahead(belt.x, belt.y, opposite(belt.direction))
      const aheadCell = ahead(belt.x, belt.y, belt.direction)
      sideRails(ctx, belt, [edgeMid(behind, belt), edgeMid(belt, aheadCell)], beltWidth, rules)
    }
  }

  drawChevrons(ctx: CanvasRenderingContext2D, belts: BeltRecord[], rules: PipelineRules, timeMs: number) {
    for (const belt of belts) chevrons(ctx, belt, rules, timeMs, isFastBelt(belt, rules))
  }
}

function strokeTracks(
  ctx: CanvasRenderingContext2D,
  belts: BeltRecord[],
  color: string,
  beltWidth: number,
) {
  if (belts.length === 0) return
  ctx.beginPath()
  for (const belt of belts) {
    const behind = ahead(belt.x, belt.y, opposite(belt.direction))
    const aheadCell = ahead(belt.x, belt.y, belt.direction)
    const start = edgeMid(behind, belt)
    const end = edgeMid(belt, aheadCell)
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = beltWidth
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'miter'
  ctx.stroke()
}

function opposite(direction: Direction): Direction {
  if (direction === 'north') return 'south'
  if (direction === 'south') return 'north'
  if (direction === 'east') return 'west'
  return 'east'
}

function edgeMid(from: { x: number; y: number }, to: { x: number; y: number }) {
  return {
    x: ((from.x + to.x) / 2 + 0.5) * cellSize,
    y: ((from.y + to.y) / 2 + 0.5) * cellSize,
  }
}

function isFastBelt(belt: BeltRecord, rules: PipelineRules) {
  return (belt.speed ?? 1) === rules.beltSpeedFast
}

/** Thin red rails near both long edges of a fast belt (clipped to the cell). */
function sideRails(
  ctx: CanvasRenderingContext2D,
  belt: BeltRecord,
  path: Point[],
  beltWidth: number,
  rules: PipelineRules,
) {
  const inset = (rules.beltFastSideInsetPercent / 100) * cellSize
  const offset = beltWidth / 2 - inset
  if (offset <= 0) return
  const stroke = Math.max(1.5, rules.beltChevronStrokePx * 0.55)
  ctx.save()
  ctx.beginPath()
  ctx.rect(belt.x * cellSize, belt.y * cellSize, cellSize, cellSize)
  ctx.clip()
  ctx.strokeStyle = rules.colorFastBeltChevron
  ctx.lineWidth = stroke
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  for (const sign of [-1, 1] as const) {
    strokeOffsetPath(ctx, path, offset * sign)
  }
  ctx.restore()
}

function strokeOffsetPath(ctx: CanvasRenderingContext2D, path: Point[], offset: number) {
  ctx.beginPath()
  let started = false
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) continue
    const ox = (-dy / len) * offset
    const oy = (dx / len) * offset
    if (!started) {
      ctx.moveTo(a.x + ox, a.y + oy)
      started = true
    } else {
      ctx.lineTo(a.x + ox, a.y + oy)
    }
    ctx.lineTo(b.x + ox, b.y + oy)
  }
  if (started) ctx.stroke()
}

function chevrons(
  ctx: CanvasRenderingContext2D,
  belt: BeltRecord,
  rules: PipelineRules,
  timeMs: number,
  fast: boolean,
) {
  const delta = directionDelta(belt.direction)
  const alongAxis = delta.dx !== 0
  const sign = alongAxis ? delta.dx : delta.dy
  const step = cellSize * 0.42
  const flowMs = fast ? rules.beltFastChevronFlowMs : rules.beltChevronFlowMs
  const travel = (timeMs / flowMs) * cellSize * sign
  const center = (alongAxis ? belt.x : belt.y) * cellSize + cellSize / 2
  const cross = (alongAxis ? belt.y : belt.x) * cellSize + cellSize / 2
  const reach = cellSize * 0.25
  const min = center - cellSize / 2 - reach
  const max = center + cellSize / 2 + reach
  const first = Math.floor((min - travel) / step)
  const last = Math.ceil((max - travel) / step)

  ctx.save()
  ctx.beginPath()
  ctx.rect(belt.x * cellSize, belt.y * cellSize, cellSize, cellSize)
  ctx.clip()
  for (let n = first; n <= last; n++) {
    const coord = n * step + travel
    const x = alongAxis ? coord : cross
    const y = alongAxis ? cross : coord
    const arm =
      cellSize * ((fast ? rules.beltFastChevronArmPercent : 14) / 100)
    drawFlowChevron(
      ctx,
      x,
      y,
      belt.direction,
      arm,
      rules.beltChevronStrokePx,
      fast ? rules.colorFastBeltChevron : rules.colorBeltChevron,
    )
  }
  ctx.restore()
}

function directionDelta(direction: Direction) {
  if (direction === 'east') return { dx: 1, dy: 0 }
  if (direction === 'west') return { dx: -1, dy: 0 }
  if (direction === 'south') return { dx: 0, dy: 1 }
  return { dx: 0, dy: -1 }
}
