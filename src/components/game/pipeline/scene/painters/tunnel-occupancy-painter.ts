import { ahead } from '../../../../../../game-server/pipeline/geometry/direction.ts'
import type {
  Direction,
  PacketShape,
  PipelineFrame,
  PipelineRules,
  TunnelPortalRecord,
} from '../../model/frame.ts'
import type { PacketMotionState, PacketSink } from '../packet-motion.ts'
import { packetSinkCenter } from '../packet-motion.ts'
import type { SceneLod } from '../scene-lod.ts'
import { darkenHex } from './darken-hex.ts'
import { elementFill } from './element-fill.ts'
import { cellSize, type CellBounds } from './grid-painter.ts'
import {
  drawOutlinedResourceDisk,
  drawOutlinedResourceGlyph,
  resourceGlyphOutline,
} from './resource-glyph.ts'

type OccupiedPair = {
  entrance: TunnelPortalRecord
  exit: TunnelPortalRecord
  queue: (PacketShape | null)[]
  leadFill: string
  fast: boolean
}

type BeadMotion = {
  shape: PacketShape
  /** Previous queue index, or -1 when the bead entered from the entrance this tick. */
  fromIndex: number
  /**
   * Current queue index, or `queue.length` when the bead left toward the exit
   * this tick (path continues through the last gap cell into the exit portal).
   */
  toIndex: number
}

/**
 * Minimal underground occupancy: a dashed thread between portals, flat beads on
 * occupied queue cells (lerped between ticks), and a small face pip on each
 * portal. Same-tick flights reuse packet sinks drawn above the portal plates.
 */
export class TunnelOccupancyPainter {
  private resourceGlyphs: Record<string, HTMLImageElement | null> = {}
  private readonly tintCache = new Map<string, HTMLCanvasElement>()
  /** Last drawn queue per pair — becomes the lerp start on the next tick. */
  private queues = new Map<string, (PacketShape | null)[]>()
  private prevQueues = new Map<string, (PacketShape | null)[]>()
  private lastTick = -1

  setResourceGlyphs(glyphs: Record<string, HTMLImageElement | null>) {
    this.resourceGlyphs = glyphs
  }

  drawUnderground(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    rules: PipelineRules,
    _timeMs: number,
    lod: SceneLod,
    _motion: PacketMotionState,
  ) {
    if (lod.machines === 'cores') return
    this.syncQueueMotion(frame)
    for (const pair of resolvePairs(frame, rules, this.prevQueues)) {
      drawThread(ctx, pair, rules)
    }
  }

  drawPortalPulse(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    rules: PipelineRules,
    timeMs: number,
    lod: SceneLod,
    bounds: CellBounds | undefined,
    motion: PacketMotionState,
  ) {
    if (lod.machines === 'cores') return
    const tickMs = rules.tickMs > 0 ? rules.tickMs : 250
    const phase = Math.min(1, Math.max(0, (timeMs - motion.syncedAtMs) / tickMs))
    // Beads draw above portals so exit flights stay visible through the last gap
    // cell and into the exit plate (under-layer draws were covered by the portal).
    for (const pair of resolvePairs(frame, rules, this.prevQueues)) {
      const prevQueue = this.prevQueues.get(pair.entrance.pairId) ?? []
      drawBeads(ctx, pair, rules, prevQueue, phase)
      if (portalVisible(pair.entrance, bounds)) drawPortalPip(ctx, pair.entrance, pair.leadFill, rules)
      if (portalVisible(pair.exit, bounds)) drawPortalPip(ctx, pair.exit, pair.leadFill, rules)
    }
    for (const sink of motion.sinks) {
      if (!sink.overPortals) continue
      drawThroughPacket(ctx, sink, rules, timeMs, lod, this.resourceGlyphs, this.tintCache)
    }
  }

  private syncQueueMotion(frame: PipelineFrame) {
    if (frame.tick === this.lastTick) return
    this.prevQueues = this.queues
    const next = new Map<string, (PacketShape | null)[]>()
    for (const portal of frame.tunnels ?? []) {
      if (portal.role !== 'entrance') continue
      next.set(portal.pairId, [...(portal.queue ?? [])])
    }
    this.queues = next
    this.lastTick = frame.tick
  }
}

function resolvePairs(
  frame: PipelineFrame,
  rules: PipelineRules,
  prevQueues: Map<string, (PacketShape | null)[]>,
): OccupiedPair[] {
  const tunnels = frame.tunnels ?? []
  const exits = new Map<string, TunnelPortalRecord>()
  for (const portal of tunnels) {
    if (portal.role === 'exit') exits.set(portal.pairId, portal)
  }
  const pairs: OccupiedPair[] = []
  for (const entrance of tunnels) {
    if (entrance.role !== 'entrance') continue
    const queue = entrance.queue ?? []
    const filled = queue.filter((slot): slot is PacketShape => slot != null)
    const transit = entrance.transit ?? []
    const prev = prevQueues.get(entrance.pairId) ?? []
    const prevFilled = prev.filter((slot): slot is PacketShape => slot != null)
    // Keep drawing while a prior bead is still flying out to the exit.
    if (filled.length === 0 && transit.length === 0 && prevFilled.length === 0) continue
    const exit = exits.get(entrance.pairId)
    if (!exit) continue
    const lead = filled[filled.length - 1] ?? transit[0] ?? prevFilled[prevFilled.length - 1]!
    pairs.push({
      entrance,
      exit,
      queue,
      leadFill: elementFill(rules, lead) ?? rules.colorPacket,
      fast: (entrance.speed ?? 1) > 1,
    })
  }
  return pairs
}

/** Hairline dashed span — reads as an underground thread, not a glow. */
function drawThread(ctx: CanvasRenderingContext2D, pair: OccupiedPair, rules: PipelineRules) {
  const a = cellCenter(pair.entrance.x, pair.entrance.y)
  const b = cellCenter(pair.exit.x, pair.exit.y)
  const dx = b.px - a.px
  const dy = b.py - a.py
  if (Math.hypot(dx, dy) < 1) return

  const ink = darkenHex(pair.fast ? rules.colorFastTunnel : rules.colorTunnel, rules.decorDarkenPercent)
  const ux = dx / Math.hypot(dx, dy)
  const uy = dy / Math.hypot(dx, dy)
  const inset = cellSize * 0.38

  ctx.save()
  ctx.strokeStyle = hexRgba(ink, rules.tunnelSeamAlpha)
  ctx.lineWidth = Math.max(1, cellSize * (rules.tunnelSeamWidthPercent / 100) * 0.22)
  ctx.lineCap = 'butt'
  ctx.setLineDash([cellSize * 0.14, cellSize * 0.1])
  ctx.beginPath()
  ctx.moveTo(a.px + ux * inset, a.py + uy * inset)
  ctx.lineTo(b.px - ux * inset, b.py - uy * inset)
  ctx.stroke()
  ctx.restore()
}

/** Flat beads lerped along the underground span between server ticks. */
function drawBeads(
  ctx: CanvasRenderingContext2D,
  pair: OccupiedPair,
  rules: PipelineRules,
  prevQueue: (PacketShape | null)[],
  phase: number,
) {
  const direction = pair.entrance.direction
  const radius = cellSize * (rules.tunnelGhostRadiusPercent / 100) * 0.55
  const gap = pair.queue.length
  const motions = matchQueueMotion(prevQueue, pair.queue)

  for (const motion of motions) {
    const path = beadPath(
      pair.entrance.x,
      pair.entrance.y,
      direction,
      motion.fromIndex,
      motion.toIndex,
      gap,
      { x: pair.exit.x, y: pair.exit.y },
    )
    const { px, py } = lerpAlongCells(path, phase)
    const fill = elementFill(rules, motion.shape) ?? rules.colorPacket
    ctx.save()
    ctx.globalAlpha = rules.tunnelGhostAlpha
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

/**
 * Pair current occupied slots with prior ones exit-first (FIFO, no overtaking).
 * `fromIndex === -1` means the bead entered from the entrance portal this tick.
 * Unmatched prior shapes leave toward the exit (`toIndex === curr.length`).
 */
export function matchQueueMotion(
  prev: (PacketShape | null)[],
  curr: (PacketShape | null)[],
): BeadMotion[] {
  const motions: BeadMotion[] = []
  const usedPrev = new Set<number>()
  let prevCursor = prev.length - 1
  for (let currIdx = curr.length - 1; currIdx >= 0; currIdx--) {
    const shape = curr[currIdx]
    if (shape == null) continue
    let fromIndex = -1
    for (let p = Math.min(prevCursor, currIdx); p >= 0; p--) {
      if (usedPrev.has(p)) continue
      if (prev[p] === shape) {
        fromIndex = p
        usedPrev.add(p)
        prevCursor = p - 1
        break
      }
    }
    motions.push({ shape, fromIndex, toIndex: currIdx })
  }
  // Packets that left the queue this tick (ejected from the last slot, often after
  // a multi-step fast advance) still need a path through the final gap cell.
  for (let p = 0; p < prev.length; p++) {
    if (usedPrev.has(p)) continue
    const shape = prev[p]
    if (shape == null) continue
    motions.push({ shape, fromIndex: p, toIndex: curr.length })
  }
  motions.sort((a, b) => a.toIndex - b.toIndex || a.fromIndex - b.fromIndex)
  return motions
}

function beadPath(
  entranceX: number,
  entranceY: number,
  direction: Direction,
  fromIndex: number,
  toIndex: number,
  gap: number,
  exit: { x: number; y: number },
) {
  const path: { x: number; y: number }[] = []
  if (fromIndex < 0) path.push({ x: entranceX, y: entranceY })
  const lastGapIndex = gap - 1
  const start = Math.max(0, fromIndex)
  const endGap = Math.min(toIndex, lastGapIndex)
  if (gap > 0 && endGap >= start) {
    for (let i = start; i <= endGap; i++) {
      path.push(gapCell(entranceX, entranceY, direction, i))
    }
  }
  if (toIndex >= gap) path.push(exit)
  if (path.length === 0) {
    path.push(gap > 0 ? gapCell(entranceX, entranceY, direction, Math.max(0, toIndex)) : exit)
  }
  return path
}

function lerpAlongCells(path: { x: number; y: number }[], phase: number) {
  if (path.length === 0) return { px: 0, py: 0 }
  if (path.length === 1 || phase <= 0) return cellCenter(path[0]!.x, path[0]!.y)
  if (phase >= 1) {
    const last = path[path.length - 1]!
    return cellCenter(last.x, last.y)
  }
  const segments = path.length - 1
  const scaled = phase * segments
  const index = Math.min(segments - 1, Math.floor(scaled))
  const local = scaled - index
  const a = cellCenter(path[index]!.x, path[index]!.y)
  const b = cellCenter(path[index + 1]!.x, path[index + 1]!.y)
  return { px: a.px + (b.px - a.px) * local, py: a.py + (b.py - a.py) * local }
}

/** Small rectangular pip on the portal face — occupancy without a heartbeat. */
function drawPortalPip(
  ctx: CanvasRenderingContext2D,
  portal: TunnelPortalRecord,
  fill: string,
  rules: PipelineRules,
) {
  const { px, py } = cellCenter(portal.x, portal.y)
  const alongX = portal.direction === 'east' || portal.direction === 'west'
  const w = alongX ? cellSize * 0.34 : cellSize * 0.12
  const h = alongX ? cellSize * 0.12 : cellSize * 0.34
  ctx.save()
  ctx.globalAlpha = Math.min(1, rules.tunnelGhostAlpha + 0.2)
  ctx.fillStyle = fill
  ctx.fillRect(px - w / 2, py - h / 2, w, h)
  ctx.restore()
}

function drawThroughPacket(
  ctx: CanvasRenderingContext2D,
  sink: PacketSink,
  rules: PipelineRules,
  timeMs: number,
  lod: SceneLod,
  glyphs: Record<string, HTMLImageElement | null>,
  tintCache: Map<string, HTMLCanvasElement>,
) {
  const { px, py } = packetSinkCenter(sink, rules, timeMs)
  const radius = cellSize * (lod.packetGlyphs ? 0.22 : 0.2)
  const outline = resourceGlyphOutline(rules)
  if (lod.packetGlyphs && sink.shape !== 'circle') {
    const el = rules.elements.elements.find((item) => item.id === sink.shape)
    const image = glyphs[sink.shape]
    if (el?.glyph && image?.complete && image.naturalWidth > 0) {
      const size = el.glyph_size_px ?? rules.resourceGlyphSizePx
      const fill = el.fill || rules.colorPacket
      drawOutlinedResourceGlyph(ctx, image, fill, px, py, size, outline, tintCache)
      return
    }
  }
  const fill = elementFill(rules, sink.shape) ?? rules.colorPacket
  drawOutlinedResourceDisk(ctx, fill, px, py, radius, outline)
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
