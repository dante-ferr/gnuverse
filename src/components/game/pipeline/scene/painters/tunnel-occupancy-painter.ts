import { ahead } from '../../../../../../game-server/pipeline/geometry/direction.ts'
import type {
  Direction,
  PacketShape,
  PipelineFrame,
  PipelineRules,
  TunnelPortalRecord,
} from '../../model/frame.ts'
import type { SceneLod } from '../scene-lod.ts'
import { elementFill } from './element-fill.ts'
import { cellSize, type CellBounds } from './grid-painter.ts'

type OccupiedPair = {
  entrance: TunnelPortalRecord
  exit: TunnelPortalRecord
  queue: (PacketShape | null)[]
  /** Crossed this tick without remaining in the queue (gap 0, or a cleared short lane). */
  transit: PacketShape[]
  leadFill: string
  fast: boolean
  occupancy: number
}

/**
 * Client-only cues for underground tunnel traffic: a glowing seam between
 * portals, soft “mole” ghosts at occupied queue slots, and a portal heartbeat.
 */
export class TunnelOccupancyPainter {
  drawUnderground(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    rules: PipelineRules,
    timeMs: number,
    lod: SceneLod,
  ) {
    if (lod.machines === 'cores') return
    for (const pair of resolvePairs(frame, rules)) {
      drawSeam(ctx, pair, rules, timeMs)
      drawMoles(ctx, pair, rules, timeMs, lod.packetGlyphs)
    }
  }

  drawPortalPulse(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    rules: PipelineRules,
    timeMs: number,
    lod: SceneLod,
    bounds?: CellBounds,
    syncedAtMs = timeMs,
  ) {
    if (lod.machines === 'cores') return
    for (const pair of resolvePairs(frame, rules)) {
      if (portalVisible(pair.entrance, bounds)) {
        drawPortalHeartbeat(ctx, pair.entrance, pair.leadFill, rules, timeMs, pair.fast)
      }
      if (portalVisible(pair.exit, bounds)) {
        drawPortalHeartbeat(ctx, pair.exit, pair.leadFill, rules, timeMs, pair.fast)
      }
      // On top of the portal plates so a gap-0 crossing is still visible.
      drawTransit(ctx, pair, rules, timeMs, syncedAtMs)
    }
  }
}

function resolvePairs(frame: PipelineFrame, rules: PipelineRules): OccupiedPair[] {
  const tunnels = frame.tunnels ?? []
  const exits = new Map<string, TunnelPortalRecord>()
  for (const portal of tunnels) {
    if (portal.role === 'exit') exits.set(portal.pairId, portal)
  }
  const pairs: OccupiedPair[] = []
  for (const entrance of tunnels) {
    if (entrance.role !== 'entrance') continue
    const queue = entrance.queue ?? []
    const transit = entrance.transit ?? []
    const filled = queue.filter((slot): slot is PacketShape => slot != null)
    if (filled.length === 0 && transit.length === 0) continue
    const exit = exits.get(entrance.pairId)
    if (!exit) continue
    const lead = transit[0] ?? filled[filled.length - 1]!
    pairs.push({
      entrance,
      exit,
      queue,
      transit,
      leadFill: elementFill(rules, lead) ?? rules.colorPacket,
      fast: (entrance.speed ?? 1) > 1,
      occupancy: queue.length === 0 ? 1 : filled.length / queue.length,
    })
  }
  return pairs
}

function drawSeam(
  ctx: CanvasRenderingContext2D,
  pair: OccupiedPair,
  rules: PipelineRules,
  timeMs: number,
) {
  const a = cellCenter(pair.entrance.x, pair.entrance.y)
  const b = cellCenter(pair.exit.x, pair.exit.y)
  const dx = b.px - a.px
  const dy = b.py - a.py
  const length = Math.hypot(dx, dy)
  if (length < 1) return

  const ux = dx / length
  const uy = dy / length
  const nx = -uy
  const ny = ux
  const halfWidth = cellSize * (rules.tunnelSeamWidthPercent / 100)
  const pulseMs = Math.max(1, pair.fast ? rules.tunnelPulseMs / 2 : rules.tunnelPulseMs)
  const shimmer = 0.55 + 0.45 * Math.sin((timeMs / pulseMs) * Math.PI * 2)
  const alpha = rules.tunnelSeamAlpha * (0.45 + 0.55 * pair.occupancy) * shimmer

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const gradient = ctx.createLinearGradient(a.px, a.py, b.px, b.py)
  const travel = ((timeMs / pulseMs) % 1 + 1) % 1
  gradient.addColorStop(0, hexRgba(pair.leadFill, 0))
  gradient.addColorStop(Math.max(0, travel - 0.18), hexRgba(pair.leadFill, 0))
  gradient.addColorStop(travel, hexRgba(pair.leadFill, alpha))
  gradient.addColorStop(Math.min(1, travel + 0.18), hexRgba(pair.leadFill, 0))
  gradient.addColorStop(1, hexRgba(pair.leadFill, 0))

  ctx.beginPath()
  ctx.moveTo(a.px + nx * halfWidth, a.py + ny * halfWidth)
  ctx.lineTo(b.px + nx * halfWidth, b.py + ny * halfWidth)
  ctx.lineTo(b.px - nx * halfWidth, b.py - ny * halfWidth)
  ctx.lineTo(a.px - nx * halfWidth, a.py - ny * halfWidth)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()

  // Soft base vein so the span stays readable between shimmer peaks.
  ctx.globalAlpha = rules.tunnelSeamAlpha * 0.35 * (0.4 + 0.6 * pair.occupancy)
  ctx.strokeStyle = hexRgba(pair.leadFill, 1)
  ctx.lineWidth = Math.max(1.5, halfWidth * 0.45)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(a.px + ux * cellSize * 0.35, a.py + uy * cellSize * 0.35)
  ctx.lineTo(b.px - ux * cellSize * 0.35, b.py - uy * cellSize * 0.35)
  ctx.stroke()
  ctx.restore()
}

function drawMoles(
  ctx: CanvasRenderingContext2D,
  pair: OccupiedPair,
  rules: PipelineRules,
  timeMs: number,
  detail: boolean,
) {
  const direction = pair.entrance.direction
  const pulseMs = Math.max(1, pair.fast ? rules.tunnelPulseMs / 2 : rules.tunnelPulseMs)
  const radius = cellSize * (rules.tunnelGhostRadiusPercent / 100)

  for (let i = 0; i < pair.queue.length; i++) {
    const shape = pair.queue[i]
    if (!shape) continue
    const cell = gapCell(pair.entrance.x, pair.entrance.y, direction, i)
    const { px, py } = cellCenter(cell.x, cell.y)
    const fill = elementFill(rules, shape) ?? rules.colorPacket
    const phase = (timeMs / pulseMs) * Math.PI * 2 + i * 0.85
    const breathe = 0.82 + 0.18 * Math.sin(phase)
    const alpha = rules.tunnelGhostAlpha * breathe

    ctx.save()
    // Squash along the travel axis so ghosts read as bumps under the floor.
    const alongX = direction === 'east' || direction === 'west'
    ctx.translate(px, py)
    ctx.scale(alongX ? 1.15 : 0.72, alongX ? 0.72 : 1.15)

    const glow = ctx.createRadialGradient(0, 0, radius * 0.15, 0, 0, radius * 1.65)
    glow.addColorStop(0, hexRgba(fill, alpha))
    glow.addColorStop(0.45, hexRgba(fill, alpha * 0.45))
    glow.addColorStop(1, hexRgba(fill, 0))
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(0, 0, radius * 1.65, 0, Math.PI * 2)
    ctx.fill()

    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = Math.min(1, alpha + 0.2)
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(0, 0, detail ? radius * 0.42 : radius * 0.5, 0, Math.PI * 2)
    ctx.fill()

    // Tiny “crack” highlight so the mole feels like light leaking up.
    ctx.globalAlpha = Math.min(1, alpha * 0.9)
    ctx.strokeStyle = hexRgba('#ffffff', 0.55)
    ctx.lineWidth = Math.max(1, radius * 0.12)
    ctx.lineCap = 'round'
    ctx.beginPath()
    if (alongX) {
      ctx.moveTo(-radius * 0.35, 0)
      ctx.lineTo(radius * 0.35, 0)
    } else {
      ctx.moveTo(0, -radius * 0.35)
      ctx.lineTo(0, radius * 0.35)
    }
    ctx.stroke()
    ctx.restore()
  }
}

/** Packet ghosts that crossed during this tick, drawn above the portal plates. */
function drawTransit(
  ctx: CanvasRenderingContext2D,
  pair: OccupiedPair,
  rules: PipelineRules,
  timeMs: number,
  syncedAtMs: number,
) {
  if (pair.transit.length === 0) return
  const a = cellCenter(pair.entrance.x, pair.entrance.y)
  const b = cellCenter(pair.exit.x, pair.exit.y)
  const tickMs = rules.tickMs > 0 ? rules.tickMs : 250
  const phase = Math.min(1, Math.max(0, (timeMs - syncedAtMs) / tickMs))
  const count = pair.transit.length
  const radius = cellSize * 0.2

  for (let i = 0; i < count; i++) {
    const shape = pair.transit[i]!
    const fill = elementFill(rules, shape) ?? rules.colorPacket
    // Spread a burst along the span, then ride them to the exit over the tick.
    const along = Math.min(1, phase * 0.72 + ((i + 1) / (count + 1)) * 0.28)
    const px = a.px + (b.px - a.px) * along
    const py = a.py + (b.py - a.py) * along
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const glow = ctx.createRadialGradient(px, py, radius * 0.2, px, py, radius * 2.4)
    glow.addColorStop(0, hexRgba(fill, 0.9))
    glow.addColorStop(0.45, hexRgba(fill, 0.35))
    glow.addColorStop(1, hexRgba(fill, 0))
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(px, py, radius * 2.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = hexRgba('#ffffff', 0.85)
    ctx.lineWidth = Math.max(1.5, radius * 0.18)
    ctx.stroke()
    ctx.restore()
  }
}

function drawPortalHeartbeat(
  ctx: CanvasRenderingContext2D,
  portal: TunnelPortalRecord,
  fill: string,
  rules: PipelineRules,
  timeMs: number,
  fast: boolean,
) {
  const { px, py } = cellCenter(portal.x, portal.y)
  const pulseMs = Math.max(1, fast ? rules.tunnelPulseMs / 2 : rules.tunnelPulseMs)
  const t = ((timeMs / pulseMs) % 1 + 1) % 1
  const rings = 2
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < rings; i++) {
    const local = (t + i / rings) % 1
    const radius = cellSize * (0.28 + local * 0.42)
    const alpha = (1 - local) * 0.38
    ctx.strokeStyle = hexRgba(fill, alpha)
    ctx.lineWidth = Math.max(1.5, cellSize * 0.045 * (1 - local * 0.5))
    ctx.beginPath()
    ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  // Soft inner wash so the portal plate itself feels lit.
  const wash = ctx.createRadialGradient(px, py, cellSize * 0.08, px, py, cellSize * 0.48)
  wash.addColorStop(0, hexRgba(fill, 0.28))
  wash.addColorStop(1, hexRgba(fill, 0))
  ctx.fillStyle = wash
  ctx.beginPath()
  ctx.arc(px, py, cellSize * 0.48, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function gapCell(entranceX: number, entranceY: number, direction: Direction, index: number) {
  let cell = { x: entranceX, y: entranceY }
  for (let step = 0; step <= index; step++) {
    cell = ahead(cell.x, cell.y, direction)
  }
  return cell
}

function cellCenter(x: number, y: number) {
  return { px: (x + 0.5) * cellSize, py: (y + 0.5) * cellSize }
}

function portalVisible(portal: TunnelPortalRecord, bounds?: CellBounds) {
  if (!bounds) return true
  return (
    portal.x >= bounds.minX &&
    portal.x <= bounds.maxX &&
    portal.y >= bounds.minY &&
    portal.y <= bounds.maxY
  )
}

function hexRgba(hex: string, alpha: number): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!match) return hex
  const raw = match[1]!
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${r},${g},${b},${a})`
}
