import { CoreMachine } from '../../../../../../game-server/pipeline/machines/core-machine.ts'
import {
  slotBracketStyleFromRules,
  type SlotBracketStyle,
} from '../../../../../../game-server/pipeline/machines/machine.ts'
import { SourceMachine } from '../../../../../../game-server/pipeline/machines/source-machine.ts'
import type { Machine } from '../../../../../../game-server/pipeline/machines/machine.ts'
import { CombinerMachine } from '../../../../../../game-server/pipeline/machines/combiner-machine.ts'
import type { PacketShape } from '../../../../../../game-server/pipeline/packets/packet.ts'
import type { ElementMachineKind, ElementRecord } from '../../../../../../game-server/pipeline/elements/index.ts'
import { glyphUrlForShape } from '../../model/frame.ts'
import type {
  CombinerRecord,
  Direction,
  PipelineFrame,
  PipelineRules,
  SourceRecord,
} from '../../model/frame.ts'
import {
  combinerCraftProgress,
  resolveRecipeRatePerMinute,
  sourceGlyphShouldOrbit,
  sourcePeriodMsForGlyph,
} from '../presentation-rates.ts'
import type { PacketMotionState } from '../packet-motion.ts'
import { sourceIsExporting, sourceOutputCell } from '../source-exporting.ts'
import { darkenHex } from './darken-hex.ts'
import { cellSize } from './grid-painter.ts'

/** Shape → resource glyph under /public/pipeline/ (optional fallback). */
const resourceDecorSrc: Record<PacketShape, string> = {
  circle: '/pipeline/resource-circle.svg',
}

export type MachineDecorImages = {
  coreFrame: HTMLImageElement | null
  coreGearOuter: HTMLImageElement | null
  coreGearInner: HTMLImageElement | null
  source: HTMLImageElement | null
  /** Craft machines from `rules.elements.machines` (keyed by machine id). */
  byKind: Record<string, HTMLImageElement | null>
  /** Element and legacy packet-shape glyphs keyed by catalog id. */
  resources: Record<string, HTMLImageElement | null>
}

/** Draws machine bodies (cell-fit rects), “[” slots, tinted decor SVGs, and orbiting glyphs. */
export class MachinePainter {
  private readonly tintCache = new Map<string, HTMLCanvasElement>()
  private readonly resourceGlyphPhaseRad = new Map<string, number>()
  private readonly lastSourceExportAtMs = new Map<string, number>()
  private lastDrawTimeMs = 0

  constructor(private readonly images: MachineDecorImages) {}

  /** Translucent combiner ghost for hover / placement preview. */
  drawCombinerGhost(
    ctx: CanvasRenderingContext2D,
    spec: {
      machineId: string
      x: number
      y: number
      facing: Direction
    },
    rules: PipelineRules,
  ) {
    if (spec.machineId !== 'combiner_2' && spec.machineId !== 'combiner_3') return
    const combiner = new CombinerMachine(
      'ghost',
      spec.machineId,
      { x: spec.x, y: spec.y },
      spec.facing,
    )
    const kind = rules.elements.machines.find((item) => item.id === spec.machineId)
    const body = kind?.color ?? rules.colorAccent
    const bracketStyle = slotBracketStyleFromRules(rules)
    ctx.save()
    ctx.globalAlpha = 0.45
    this.machine(ctx, combiner, body, decorForKind(this.images, spec.machineId), rules, bracketStyle, {
      centerDecor: spec.machineId === 'combiner_3',
    })
    ctx.restore()
  }

  draw(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    rules: PipelineRules,
    cameraZoom: number,
    timeMs: number,
    motion: PacketMotionState,
  ) {
    const deltaMs = this.lastDrawTimeMs > 0 ? Math.max(0, timeMs - this.lastDrawTimeMs) : 0
    this.lastDrawTimeMs = timeMs
    const coreSpecs = frame.cores?.length ? frame.cores : [frame.core]
    const specs = frame.sources?.length ? frame.sources : [frame.source]
    const bracketStyle = slotBracketStyleFromRules(rules)
    for (const coreSpec of coreSpecs) {
      const core = new CoreMachine(coreSpec.id, { x: coreSpec.x, y: coreSpec.y })
      this.drawCore(ctx, core, rules, bracketStyle, timeMs)
    }
    for (const spec of frame.combiners ?? []) {
      const combiner = new CombinerMachine(
        spec.id,
        spec.machineId,
        { x: spec.x, y: spec.y },
        spec.facing,
      )
      const kind = rules.elements.machines.find((item) => item.id === spec.machineId)
      const body = kind?.color ?? rules.colorAccent
      this.machine(ctx, combiner, body, decorForKind(this.images, spec.machineId), rules, bracketStyle, {
        centerDecor: spec.machineId === 'combiner_3',
      })
      this.drawCombinerCraftOverlay(ctx, combiner, spec, rules, cameraZoom, timeMs, deltaMs)
    }
    for (const spec of specs) {
      const source = new SourceMachine(spec.id, { x: spec.x, y: spec.y }, spec.direction, spec.shape, 1)
      this.drawSource(ctx, source, rules, bracketStyle)
      const glyphId = sourceGlyphId(spec)
      const outputCell = sourceOutputCell(spec)
      const exporting = sourceIsExporting(outputCell, motion)
      const periodMs = sourcePeriodMsForGlyph(rules, glyphId)
      if (exporting) this.lastSourceExportAtMs.set(spec.id, timeMs)
      const shouldOrbit = sourceGlyphShouldOrbit(
        exporting,
        this.lastSourceExportAtMs.get(spec.id),
        timeMs,
        periodMs,
      )
      this.drawOrbitingResourceGlyph(
        ctx,
        source,
        spec.id,
        glyphId,
        rules,
        cameraZoom,
        deltaMs,
        shouldOrbit,
      )
    }
  }

  private drawCore(
    ctx: CanvasRenderingContext2D,
    machine: Machine,
    rules: PipelineRules,
    bracketStyle: SlotBracketStyle,
    timeMs: number,
  ) {
    const { px, py, width, height } = machineRect(machine)
    this.drawMachineBody(ctx, machine, rules.colorCore, rules, bracketStyle, px, py, width, height)

    const frameInk = darkenHex(rules.colorCore, rules.decorDarkenPercent)
    drawTintedDecor(ctx, this.images.coreFrame, frameInk, px, py, width, height, this.tintCache)

    // Gears share the core center pivot (SVGs recentered to 256,256).
    // Outline: lighter than colorOutline, even circular offsets.
    const outerAngle = (2 * Math.PI * timeMs) / rules.coreGearOuterMs
    const outerInk = rules.colorAccent
    drawCoreGear(
      ctx,
      this.images.coreGearOuter,
      outerInk,
      darkenHex(outerInk, CORE_GEAR_OUTLINE_DARKEN_PERCENT),
      px,
      py,
      width,
      height,
      CORE_GEAR_OUTER_SCALE,
      outerAngle,
      rules.outlineWidthPx,
      this.tintCache,
    )

    const innerInk = darkenHex(rules.colorAccent, rules.decorDarkenPercent)
    const innerAngle = (-2 * Math.PI * timeMs) / rules.coreGearInnerMs
    drawCoreGear(
      ctx,
      this.images.coreGearInner,
      innerInk,
      darkenHex(innerInk, CORE_GEAR_OUTLINE_DARKEN_PERCENT),
      px,
      py,
      width,
      height,
      CORE_GEAR_INNER_SCALE,
      innerAngle,
      rules.outlineWidthPx,
      this.tintCache,
    )
  }

  private drawSource(
    ctx: CanvasRenderingContext2D,
    machine: SourceMachine,
    rules: PipelineRules,
    bracketStyle: SlotBracketStyle,
  ) {
    const { px, py, width, height } = machineRect(machine)
    const cx = px + width / 2
    const cy = py + height / 2
    const radius = width / 2
    // Ports under the body so the circle covers the bracket root.
    this.drawSlotBrackets(ctx, machine, rules.colorSource, rules, bracketStyle)
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = rules.colorSource
    ctx.fill()
    ctx.strokeStyle = rules.colorOutline
    ctx.lineWidth = rules.outlineWidthPx
    ctx.stroke()
    const decorInk = darkenHex(rules.colorSource, rules.decorDarkenPercent)
    drawTintedDecor(ctx, this.images.source, decorInk, px, py, width, height, this.tintCache)
  }

  private machine(
    ctx: CanvasRenderingContext2D,
    machine: Machine,
    bodyColor: string,
    decor: HTMLImageElement | null,
    rules: PipelineRules,
    bracketStyle: SlotBracketStyle,
    options: { centerDecor?: boolean } = {},
  ) {
    const { px, py, width, height } = machineRect(machine)
    this.drawMachineBody(ctx, machine, bodyColor, rules, bracketStyle, px, py, width, height)
    const decorInk = darkenHex(bodyColor, rules.decorDarkenPercent)
    if (options.centerDecor) {
      drawTintedDecorCentered(ctx, decor, decorInk, px, py, width, height, this.tintCache)
    } else {
      drawTintedDecor(ctx, decor, decorInk, px, py, width, height, this.tintCache)
    }
  }

  private drawMachineBody(
    ctx: CanvasRenderingContext2D,
    machine: Machine,
    bodyColor: string,
    rules: PipelineRules,
    bracketStyle: SlotBracketStyle,
    px: number,
    py: number,
    width: number,
    height: number,
  ) {
    // Ports under the body so the plate covers the bracket root.
    this.drawSlotBrackets(ctx, machine, bodyColor, rules, bracketStyle)
    ctx.fillStyle = bodyColor
    ctx.fillRect(px, py, width, height)
    ctx.strokeStyle = rules.colorOutline
    ctx.lineWidth = rules.outlineWidthPx
    ctx.strokeRect(px, py, width, height)
  }

  private drawSlotBrackets(
    ctx: CanvasRenderingContext2D,
    machine: Machine,
    bodyColor: string,
    rules: PipelineRules,
    bracketStyle: SlotBracketStyle,
  ) {
    for (const slot of machine.slots) {
      const path = machine.slotBracket(slot, cellSize, bracketStyle)
      ctx.beginPath()
      ctx.moveTo(path[0]!.x, path[0]!.y)
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i]!.x, path[i]!.y)
      ctx.closePath()
      ctx.fillStyle = bodyColor
      ctx.fill()
      ctx.strokeStyle = rules.colorOutline
      ctx.lineWidth = rules.outlineWidthPx
      ctx.stroke()
    }
  }

  private drawCombinerCraftOverlay(
    ctx: CanvasRenderingContext2D,
    machine: CombinerMachine,
    spec: CombinerRecord,
    rules: PipelineRules,
    cameraZoom: number,
    timeMs: number,
    deltaMs: number,
  ) {
    if (spec.craftRemaining == null || spec.craftRemaining <= 0 || !spec.recipeId) return
    const { px, py, width, height } = machineRect(machine)
    const cx = px + width / 2
    const cy = py + height / 2
    const recipeRate = resolveRecipeRatePerMinute(rules, spec.recipeId)
    const progress = combinerCraftProgress(spec.craftRemaining, recipeRate, rules.tickMs)
    const wheelRadius = Math.min(width, height) * 0.42
    ctx.save()
    ctx.strokeStyle = rules.colorOutline
    ctx.lineWidth = Math.max(rules.outlineWidthPx, 2)
    ctx.beginPath()
    ctx.arc(cx, cy, wheelRadius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    const glyphId = spec.recipeId
    const worldCx = (machine.origin.x + machine.width / 2) * cellSize
    const worldCy = (machine.origin.y + machine.height / 2) * cellSize
    let phase = this.resourceGlyphPhaseRad.get(spec.id) ?? 0
    if (rules.resourceGlyphOrbitMs > 0) {
      phase += (2 * Math.PI * deltaMs) / rules.resourceGlyphOrbitMs
      this.resourceGlyphPhaseRad.set(spec.id, phase)
    }
    const ox = Math.cos(phase) * rules.resourceGlyphOrbitPx * 0.6
    const oy = Math.sin(phase) * rules.resourceGlyphOrbitPx * 0.6
    const zoom = cameraZoom > 0 ? cameraZoom : 1
    ctx.save()
    ctx.translate(worldCx, worldCy)
    ctx.scale(1 / zoom, 1 / zoom)
    ctx.translate(ox, oy)
    this.drawResourceGlyph(ctx, glyphId, rules)
    ctx.restore()
    void timeMs
  }

  private drawOrbitingResourceGlyph(
    ctx: CanvasRenderingContext2D,
    machine: Machine,
    sourceId: string,
    glyphId: string,
    rules: PipelineRules,
    cameraZoom: number,
    deltaMs: number,
    shouldOrbit: boolean,
  ) {
    const worldCx = (machine.origin.x + machine.width / 2) * cellSize
    const worldCy = (machine.origin.y + machine.height / 2) * cellSize
    let phase = this.resourceGlyphPhaseRad.get(sourceId) ?? 0
    if (shouldOrbit && rules.resourceGlyphOrbitMs > 0) {
      phase += (2 * Math.PI * deltaMs) / rules.resourceGlyphOrbitMs
      this.resourceGlyphPhaseRad.set(sourceId, phase)
    }
    const ox = shouldOrbit ? Math.cos(phase) * rules.resourceGlyphOrbitPx : 0
    const oy = shouldOrbit ? Math.sin(phase) * rules.resourceGlyphOrbitPx : 0
    const zoom = cameraZoom > 0 ? cameraZoom : 1
    ctx.save()
    ctx.translate(worldCx, worldCy)
    ctx.scale(1 / zoom, 1 / zoom)
    ctx.translate(ox, oy)
    this.drawResourceGlyph(ctx, glyphId, rules)
    ctx.restore()
  }

  private drawResourceGlyph(ctx: CanvasRenderingContext2D, glyphId: string, rules: PipelineRules) {
    const size = resourceGlyphSizePx(rules, glyphId)
    if (glyphId === 'circle') {
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
    const image = this.images.resources[glyphId]
    if (image?.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, -size / 2, -size / 2, size, size)
    }
  }
}

function sourceGlyphId(spec: SourceRecord): string {
  return spec.role ?? spec.shape
}

function resourceGlyphSizePx(rules: PipelineRules, glyphId: string): number {
  if (glyphId === 'circle') return rules.resourceGlyphSizePx
  const el = rules.elements.elements.find((item) => item.id === glyphId)
  return el?.glyph_size_px ?? rules.resourceGlyphSizePx
}

function machineRect(machine: Machine) {
  const px = machine.origin.x * cellSize
  const py = machine.origin.y * cellSize
  const width = machine.width * cellSize
  const height = machine.height * cellSize
  return { px, py, width, height }
}

/** Public URL for a TOML decor path (`pipeline/...` → `/pipeline/...`). */
export function publicDecorUrl(decorPath: string): string {
  const trimmed = decorPath.trim()
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/** Decor image for a catalog craft machine; pairing with `kind.color` is the caller’s job. */
export function decorForKind(images: MachineDecorImages, machineId: string): HTMLImageElement | null {
  return images.byKind[machineId] ?? null
}

/** Prefetch core/source decor, catalog craft machines, and element resource glyphs. */
export function loadMachineDecor(
  onLoad: () => void,
  machineKinds?: readonly Pick<ElementMachineKind, 'id' | 'decor'>[],
  catalogElements?: readonly Pick<ElementRecord, 'id' | 'glyph'>[],
  rules?: PipelineRules | null,
): MachineDecorImages {
  const coreFrame = new Image()
  coreFrame.src = '/pipeline/core-frame.svg'
  coreFrame.onload = onLoad
  const coreGearOuter = new Image()
  coreGearOuter.src = '/pipeline/core-gear-outer.svg'
  coreGearOuter.onload = onLoad
  const coreGearInner = new Image()
  coreGearInner.src = '/pipeline/core-gear-inner.svg'
  coreGearInner.onload = onLoad
  const source = new Image()
  source.src = '/pipeline/source-decor.svg'
  source.onload = onLoad
  const byKind: MachineDecorImages['byKind'] = {}
  for (const kind of machineKinds ?? []) {
    if (byKind[kind.id]) continue
    const image = new Image()
    image.src = publicDecorUrl(kind.decor)
    image.onload = onLoad
    byKind[kind.id] = image
  }
  const resources: MachineDecorImages['resources'] = {}
  for (const [shape, src] of Object.entries(resourceDecorSrc) as [PacketShape, string][]) {
    const image = new Image()
    image.src = src
    image.onload = onLoad
    resources[shape] = image
  }
  for (const el of catalogElements ?? []) {
    if (!el.glyph || resources[el.id]) continue
    const url = glyphUrlForShape(rules ?? null, el.id) ?? publicDecorUrl(el.glyph)
    const image = new Image()
    image.src = url
    image.onload = onLoad
    resources[el.id] = image
  }
  return { coreFrame, coreGearOuter, coreGearInner, source, byKind, resources }
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

/** Square SVG fitted to the short side and centered in a possibly non-square footprint. */
function drawTintedDecorCentered(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  ink: string,
  x: number,
  y: number,
  width: number,
  height: number,
  cache: Map<string, HTMLCanvasElement>,
) {
  const size = Math.min(width, height)
  const dx = x + (width - size) / 2
  const dy = y + (height - size) / 2
  drawTintedDecor(ctx, image, ink, dx, dy, size, size, cache)
}

/** Fraction of the core footprint used by each gear layer (inner < outer). */
const CORE_GEAR_OUTER_SCALE = 0.74
const CORE_GEAR_INNER_SCALE = 0.48
/** Offset samples around the silhouette for an even, round outline. */
const CORE_GEAR_OUTLINE_SAMPLES = 24
/** Outline thickness relative to `outline_width_px` (world px after multiply). */
const CORE_GEAR_OUTLINE_WIDTH_FACTOR = 1.85
/** Darken the gear fill to get a lighter outline than `color_outline`. */
const CORE_GEAR_OUTLINE_DARKEN_PERCENT = 48

function drawTintedDecorRotated(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  ink: string,
  x: number,
  y: number,
  width: number,
  height: number,
  angleRad: number,
  cache: Map<string, HTMLCanvasElement>,
) {
  const cx = x + width / 2
  const cy = y + height / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angleRad)
  drawTintedDecor(ctx, image, ink, -width / 2, -height / 2, width, height, cache)
  ctx.restore()
}

/**
 * Rotating gear centered in the core footprint.
 * Outline is an even ring (circular offsets), then the fill sits on top.
 */
function drawCoreGear(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  fillInk: string,
  outlineInk: string,
  px: number,
  py: number,
  width: number,
  height: number,
  scale: number,
  angleRad: number,
  outlineWidthPx: number,
  cache: Map<string, HTMLCanvasElement>,
) {
  const size = Math.min(width, height) * scale
  const cx = px + width / 2
  const cy = py + height / 2
  const x0 = cx - size / 2
  const y0 = cy - size / 2
  const outlineRadius = Math.max(outlineWidthPx * CORE_GEAR_OUTLINE_WIDTH_FACTOR, size * 0.03)
  for (let i = 0; i < CORE_GEAR_OUTLINE_SAMPLES; i++) {
    const a = (2 * Math.PI * i) / CORE_GEAR_OUTLINE_SAMPLES
    const ox = Math.cos(a) * outlineRadius
    const oy = Math.sin(a) * outlineRadius
    drawTintedDecorRotated(ctx, image, outlineInk, x0 + ox, y0 + oy, size, size, angleRad, cache)
  }
  drawTintedDecorRotated(ctx, image, fillInk, x0, y0, size, size, angleRad, cache)
}