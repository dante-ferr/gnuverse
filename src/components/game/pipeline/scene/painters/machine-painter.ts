import { CoreMachine } from '../../../../../../game-server/pipeline/machines/core-machine.ts'
import {
  portsConnected,
  type PortSlot,
} from '../../../../../../game-server/pipeline/world/edit/building-slots.ts'
import {
  slotBracketStyleFromRules,
  type SlotBracketStyle,
} from '../../../../../../game-server/pipeline/machines/machine.ts'
import { SourceMachine } from '../../../../../../game-server/pipeline/machines/source-machine.ts'
import type { Machine } from '../../../../../../game-server/pipeline/machines/machine.ts'
import { CombinerMachine } from '../../../../../../game-server/pipeline/machines/combiner-machine.ts'
import { SplitterMachine } from '../../../../../../game-server/pipeline/machines/splitter-machine.ts'
import {
  TunnelPortalMachine,
  type TunnelPortalRole,
} from '../../../../../../game-server/pipeline/machines/tunnel-machine.ts'
import type { PacketShape } from '../../../../../../game-server/pipeline/packets/packet.ts'
import type { ElementMachineKind, ElementRecord } from '../../../../../../game-server/pipeline/elements/index.ts'
import { glyphUrlForShape } from '../../model/frame.ts'
import type {
  CombinerRecord,
  CoreRecord,
  Direction,
  PipelineFrame,
  PipelineRules,
  SourceRecord,
  SplitterRecord,
  TunnelPortalRecord,
} from '../../model/frame.ts'
import { machinesFromFrame } from '../../placement-building-slots.ts'
import { getPlacementFrame } from '../../placement-rules.ts'
import type { StructurePreviewMachine } from '../../structures/types.ts'
import {
  combinerCraftProgress,
  resolveRecipeRatePerMinute,
  coreGearsShouldSpin,
  sourceGlyphShouldOrbit,
  sourcePeriodMsForGlyph,
} from '../presentation-rates.ts'
import type { PacketMotionState } from '../packet-motion.ts'
import { sourceIsExporting, sourceOutputCell } from '../source-exporting.ts'
import { darkenHex } from './darken-hex.ts'
import { elementFill } from './element-fill.ts'
import { glyphSpaceScale, type MachineLod } from '../scene-lod.ts'
import { cellSize, type CellBounds } from './grid-painter.ts'
import {
  drawOutlinedResourceDisk,
  drawOutlinedResourceGlyph,
  resourceGlyphOutline,
} from './resource-glyph.ts'
import { drawTintedImage } from './tint-image.ts'

/** Shape → resource glyph under /public/pipeline/ (optional fallback). */
const resourceDecorSrc: Record<PacketShape, string> = {
  circle: '/pipeline/resource-circle.svg',
}

export type MachineDecorImages = {
  coreFrame: HTMLImageElement | null
  coreGearOuter: HTMLImageElement | null
  coreGearInner: HTMLImageElement | null
  source: HTMLImageElement | null
  splitter: HTMLImageElement | null
  tunnelEntrance: HTMLImageElement | null
  tunnelExit: HTMLImageElement | null
  tunnelFastEntrance: HTMLImageElement | null
  tunnelFastExit: HTMLImageElement | null
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
  /** Last primary output element id shown on each combiner (persists after craft). */
  private readonly lastCombinerGlyphById = new Map<string, string>()
  private readonly lastSeenCoreIntakeTick = new Map<string, number>()
  private readonly lastCoreActiveAtMs = new Map<string, number>()
  private readonly coreGearOuterAngleRad = new Map<string, number>()
  private readonly coreGearInnerAngleRad = new Map<string, number>()
  private lastDrawTimeMs = 0
  private colorRules: PipelineRules | null = null
  private colorByMachineId = new Map<string, string>()

  constructor(private readonly images: MachineDecorImages) {}

  /** Translucent machine ghost for hover / placement preview. */
  drawMachineGhost(ctx: CanvasRenderingContext2D, spec: StructurePreviewMachine, rules: PipelineRules) {
    const bracketStyle = slotBracketStyleFromRules(rules)
    const alpha = spec.placementValid === false ? 0.22 : 0.45
    ctx.save()
    ctx.globalAlpha = alpha
    if (spec.machineId === 'combiner_2' || spec.machineId === 'combiner_3') {
      const combiner = new CombinerMachine(
        'ghost',
        spec.machineId,
        { x: spec.x, y: spec.y },
        spec.facing,
      )
      const kind = rules.elements.machines.find((item) => item.id === spec.machineId)
      const body = kind?.color ?? rules.colorAccent
      this.machine(ctx, combiner, body, decorForKind(this.images, spec.machineId), rules, bracketStyle, {
        centerDecor: spec.machineId === 'combiner_3',
      })
      ctx.restore()
      return
    }
    if (spec.machineId === 'splitter') {
      const splitter = new SplitterMachine(
        'ghost',
        { x: spec.x, y: spec.y },
        spec.facing,
        { id: '', nickname: '' },
      )
      const previewFrame = getPlacementFrame()
      const hideBracket = previewFrame
        ? logisticPortBracketHidden(splitter, machinesFromFrame(previewFrame))
        : undefined
      this.machine(ctx, splitter, rules.colorSplitter, this.images.splitter, rules, bracketStyle, {
        decorFacing: spec.facing,
        hidePortBracket: hideBracket,
      })
      ctx.restore()
      return
    }
    if (spec.machineId === 'tunnel' || spec.machineId === 'fast_tunnel') {
      const role: TunnelPortalRole = spec.tunnelRole ?? 'entrance'
      const portal = new TunnelPortalMachine(
        'ghost',
        { x: spec.x, y: spec.y },
        role,
        'ghost-pair',
        spec.facing,
        { id: '', nickname: '' },
      )
      const fast = spec.machineId === 'fast_tunnel'
      const decor = tunnelDecorImage(this.images, role, fast)
      const frame = getPlacementFrame()
      const hideBracket = frame
        ? logisticPortBracketHidden(portal, machinesFromFrame(frame))
        : undefined
      const body = fast ? rules.colorFastTunnel : rules.colorTunnel
      this.machine(ctx, portal, body, decor, rules, bracketStyle, {
        decorFacing: spec.facing,
        hidePortBracket: hideBracket,
        decorInk: fast ? rules.colorFastBeltChevron : undefined,
        fastSideRails: fast ? spec.facing : undefined,
      })
    }
    ctx.restore()
  }

  /** @deprecated Use `drawMachineGhost`. */
  drawCombinerGhost(
    ctx: CanvasRenderingContext2D,
    spec: {
      machineId: string
      x: number
      y: number
      facing: Direction
      width?: number
      height?: number
    },
    rules: PipelineRules,
  ) {
    if (spec.machineId !== 'combiner_2' && spec.machineId !== 'combiner_3') return
    this.drawMachineGhost(
      ctx,
      {
        machineId: spec.machineId,
        x: spec.x,
        y: spec.y,
        facing: spec.facing,
        width: spec.width ?? CombinerMachine.sizeFor(spec.machineId, spec.facing).width,
        height: spec.height ?? CombinerMachine.sizeFor(spec.machineId, spec.facing).height,
      },
      rules,
    )
  }

  /** Changes when decor images finish loading, so a cached machine layer can rebuild. */
  decorStamp() {
    let h = 0
    const mark = (image: HTMLImageElement | null | undefined) => {
      h = (h * 2 + (image && image.complete && image.naturalWidth > 0 ? 1 : 0)) | 0
    }
    mark(this.images.coreFrame)
    mark(this.images.source)
    mark(this.images.splitter)
    mark(this.images.tunnelEntrance)
    mark(this.images.tunnelExit)
    mark(this.images.tunnelFastEntrance)
    mark(this.images.tunnelFastExit)
    for (const image of Object.values(this.images.byKind)) mark(image)
    return String(h)
  }

  draw(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    rules: PipelineRules,
    cameraZoom: number,
    timeMs: number,
    motion: PacketMotionState,
    bounds?: CellBounds,
    pass: 'all' | 'static' | 'dynamic' = 'all',
    machineLod: MachineLod = 'full',
  ) {
    const drawBodies = pass !== 'dynamic'
    const drawMotion = pass !== 'static'
    const detail = machineLod === 'full'
    const showNonCore = machineLod !== 'cores'
    const flat = machineLod === 'flat'
    const deltaMs = drawMotion && this.lastDrawTimeMs > 0 ? Math.max(0, timeMs - this.lastDrawTimeMs) : 0
    if (drawMotion) this.lastDrawTimeMs = timeMs
    const coreSpecs = frame.cores?.length ? frame.cores : [frame.core]
    const specs = frame.sources?.length ? frame.sources : [frame.source]
    const bracketStyle = slotBracketStyleFromRules(rules)
    const frameMachines = drawBodies && detail ? machinesFromFrame(frame) : []
    const ports = drawBodies && detail ? indexPortSlots(frameMachines) : null
    const gearSamples = cameraZoom < 0.65 || !detail ? 8 : CORE_GEAR_OUTLINE_SAMPLES
    for (const coreSpec of coreSpecs) {
      if (drawMotion) this.noteCoreIntake(coreSpec, timeMs)
      if (!footprintVisible(coreSpec.x, coreSpec.y, CoreMachine.size, CoreMachine.size, bounds)) continue
      const core = new CoreMachine(coreSpec.id, { x: coreSpec.x, y: coreSpec.y })
      this.drawCore(ctx, core, rules, bracketStyle, timeMs, deltaMs, drawBodies, drawMotion, gearSamples)
    }
    for (const spec of frame.combiners ?? []) {
      const size = CombinerMachine.sizeFor(spec.machineId, spec.facing)
      if (!footprintVisible(spec.x, spec.y, size.width, size.height, bounds)) continue
      const combiner = new CombinerMachine(spec.id, spec.machineId, { x: spec.x, y: spec.y }, spec.facing)
      if (drawBodies && showNonCore) {
        const body = this.machineColor(rules, spec.machineId)
        if (flat) {
          this.drawFlatPlate(ctx, combiner, body, rules)
        } else {
          this.machine(ctx, combiner, body, decorForKind(this.images, spec.machineId), rules, bracketStyle, {
            centerDecor: spec.machineId === 'combiner_3',
          })
        }
      }
      // Craft / output glyphs stay visible at every zoom band.
      if (drawMotion) this.drawCombinerCraftOverlay(ctx, combiner, spec, rules, cameraZoom, timeMs, motion)
    }
    if (drawBodies && showNonCore && ports) {
      for (const spec of frame.splitters ?? []) {
        if (!footprintVisible(spec.x, spec.y, 1, 1, bounds)) continue
        this.drawSplitter(ctx, spec, rules, bracketStyle, ports)
      }
      for (const spec of frame.tunnels ?? []) {
        if (!footprintVisible(spec.x, spec.y, 1, 1, bounds)) continue
        this.drawTunnelPortal(ctx, spec, rules, bracketStyle, ports)
      }
    } else if (drawBodies && showNonCore && flat) {
      for (const spec of frame.splitters ?? []) {
        if (!footprintVisible(spec.x, spec.y, 1, 1, bounds)) continue
        const splitter = new SplitterMachine(
          spec.id,
          { x: spec.x, y: spec.y },
          spec.facing,
          { id: spec.authorId, nickname: spec.authorNickname },
        )
        this.drawFlatPlate(ctx, splitter, rules.colorSplitter, rules)
      }
      for (const spec of frame.tunnels ?? []) {
        if (!footprintVisible(spec.x, spec.y, 1, 1, bounds)) continue
        const portal = new TunnelPortalMachine(
          spec.id,
          { x: spec.x, y: spec.y },
          spec.role,
          spec.pairId,
          spec.direction,
          { id: spec.authorId, nickname: spec.authorNickname },
          spec.queue?.length ?? 0,
        )
        const fast = (spec.speed ?? 1) > 1
        this.drawFlatPlate(ctx, portal, fast ? rules.colorFastTunnel : rules.colorTunnel, rules)
      }
    }
    for (const spec of specs) {
      if (!footprintVisible(spec.x, spec.y, SourceMachine.size, SourceMachine.size, bounds)) continue
      const source = new SourceMachine(spec.id, { x: spec.x, y: spec.y }, spec.direction, spec.shape, 1)
      const glyphId = sourceGlyphId(spec)
      const body = elementFill(rules, glyphId) ?? rules.colorSource
      if (drawBodies && showNonCore) {
        if (flat) this.drawFlatSource(ctx, source, body, rules)
        else this.drawSource(ctx, source, body, rules, bracketStyle)
      }
      if (!drawMotion) continue
      // Source glyphs stay visible at every zoom band (bodies may be omitted).
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
    // Core/combiner brackets above logistics so adjacent plugs cannot bury them.
    // Source outputs stay under the circle (drawn once in drawSource).
    if (drawBodies && detail) this.drawNonLogisticBrackets(ctx, frame, rules, bracketStyle, bounds)
  }

  private drawFlatPlate(ctx: CanvasRenderingContext2D, machine: Machine, bodyColor: string, rules: PipelineRules) {
    const { px, py, width, height } = machineRect(machine)
    ctx.fillStyle = bodyColor
    ctx.fillRect(px, py, width, height)
    ctx.strokeStyle = rules.colorOutline
    ctx.lineWidth = Math.max(1, rules.outlineWidthPx * 0.75)
    ctx.strokeRect(px, py, width, height)
  }

  private drawFlatSource(
    ctx: CanvasRenderingContext2D,
    machine: SourceMachine,
    bodyColor: string,
    rules: PipelineRules,
  ) {
    const { px, py, width, height } = machineRect(machine)
    const cx = px + width / 2
    const cy = py + height / 2
    const radius = width / 2
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = bodyColor
    ctx.fill()
    ctx.strokeStyle = rules.colorOutline
    ctx.lineWidth = Math.max(1, rules.outlineWidthPx * 0.75)
    ctx.stroke()
  }

  private machineColor(rules: PipelineRules, machineId: string) {
    if (this.colorRules !== rules) {
      this.colorRules = rules
      this.colorByMachineId = new Map(rules.elements.machines.map((item) => [item.id, item.color]))
    }
    return this.colorByMachineId.get(machineId) ?? rules.colorAccent
  }

  private drawNonLogisticBrackets(
    ctx: CanvasRenderingContext2D,
    frame: PipelineFrame,
    rules: PipelineRules,
    bracketStyle: SlotBracketStyle,
    bounds?: CellBounds,
  ) {
    const coreSpecs = frame.cores?.length ? frame.cores : [frame.core]
    for (const coreSpec of coreSpecs) {
      if (!footprintVisible(coreSpec.x, coreSpec.y, CoreMachine.size, CoreMachine.size, bounds)) continue
      const core = new CoreMachine(coreSpec.id, { x: coreSpec.x, y: coreSpec.y })
      this.drawSlotBrackets(ctx, core, rules.colorCore, rules, bracketStyle)
    }
    for (const spec of frame.combiners ?? []) {
      const size = CombinerMachine.sizeFor(spec.machineId, spec.facing)
      if (!footprintVisible(spec.x, spec.y, size.width, size.height, bounds)) continue
      const combiner = new CombinerMachine(spec.id, spec.machineId, { x: spec.x, y: spec.y }, spec.facing)
      this.drawSlotBrackets(ctx, combiner, this.machineColor(rules, spec.machineId), rules, bracketStyle)
    }
  }

  private noteCoreIntake(spec: CoreRecord, timeMs: number) {
    if (spec.lastIntakeTick === undefined) return
    const seen = this.lastSeenCoreIntakeTick.get(spec.id)
    if (seen !== undefined && spec.lastIntakeTick <= seen) return
    this.lastSeenCoreIntakeTick.set(spec.id, spec.lastIntakeTick)
    this.lastCoreActiveAtMs.set(spec.id, timeMs)
  }

  private drawCore(
    ctx: CanvasRenderingContext2D,
    machine: Machine,
    rules: PipelineRules,
    bracketStyle: SlotBracketStyle,
    timeMs: number,
    deltaMs: number,
    drawBodies: boolean,
    drawMotion: boolean,
    gearSamples: number,
  ) {
    const { px, py, width, height } = machineRect(machine)
    if (drawBodies) {
      this.drawMachineBody(ctx, machine, rules.colorCore, rules, bracketStyle, px, py, width, height)
      const frameInk = darkenHex(rules.colorCore, rules.decorDarkenPercent)
      drawTintedDecor(ctx, this.images.coreFrame, frameInk, px, py, width, height, this.tintCache)
    }
    if (!drawMotion) return

    const spinning = coreGearsShouldSpin(
      this.lastCoreActiveAtMs.get(machine.id),
      timeMs,
      rules.coreGearActiveMs,
    )
    let outerAngle = this.coreGearOuterAngleRad.get(machine.id) ?? 0
    let innerAngle = this.coreGearInnerAngleRad.get(machine.id) ?? 0
    if (spinning && deltaMs > 0) {
      outerAngle += (2 * Math.PI * deltaMs) / rules.coreGearOuterMs
      innerAngle -= (2 * Math.PI * deltaMs) / rules.coreGearInnerMs
      this.coreGearOuterAngleRad.set(machine.id, outerAngle)
      this.coreGearInnerAngleRad.set(machine.id, innerAngle)
    }

    // Gears share the core center pivot (SVGs recentered to 256,256).
    // Outline: lighter than colorOutline, even circular offsets.
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
      gearSamples,
    )

    const innerInk = darkenHex(rules.colorAccent, rules.decorDarkenPercent)
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
      gearSamples,
    )
  }

  private drawSplitter(
    ctx: CanvasRenderingContext2D,
    spec: SplitterRecord,
    rules: PipelineRules,
    bracketStyle: SlotBracketStyle,
    ports: Map<string, IndexedPort[]>,
  ) {
    const splitter = new SplitterMachine(
      spec.id,
      { x: spec.x, y: spec.y },
      spec.facing,
      { id: spec.authorId, nickname: spec.authorNickname },
    )
    this.machine(ctx, splitter, rules.colorSplitter, this.images.splitter, rules, bracketStyle, {
      decorFacing: spec.facing,
      hidePortBracket: hideConnected(splitter.id, ports),
    })
  }

  private drawTunnelPortal(
    ctx: CanvasRenderingContext2D,
    spec: TunnelPortalRecord,
    rules: PipelineRules,
    bracketStyle: SlotBracketStyle,
    ports: Map<string, IndexedPort[]>,
  ) {
    const portal = new TunnelPortalMachine(
      spec.id,
      { x: spec.x, y: spec.y },
      spec.role,
      spec.pairId,
      spec.direction,
      { id: spec.authorId, nickname: spec.authorNickname },
      spec.queue?.length ?? 0,
    )
    const fast = (spec.speed ?? 1) > 1
    const decor = tunnelDecorImage(this.images, spec.role, fast)
    const body = fast ? rules.colorFastTunnel : rules.colorTunnel
    this.machine(ctx, portal, body, decor, rules, bracketStyle, {
      decorFacing: spec.direction,
      hidePortBracket: hideConnected(portal.id, ports),
      decorInk: fast ? rules.colorFastBeltChevron : undefined,
      fastSideRails: fast ? spec.direction : undefined,
    })
  }

  private drawSource(
    ctx: CanvasRenderingContext2D,
    machine: SourceMachine,
    bodyColor: string,
    rules: PipelineRules,
    bracketStyle: SlotBracketStyle,
  ) {
    const { px, py, width, height } = machineRect(machine)
    const cx = px + width / 2
    const cy = py + height / 2
    const radius = width / 2
    // Ports under the body so the circle covers the bracket root.
    this.drawSlotBrackets(ctx, machine, bodyColor, rules, bracketStyle)
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = bodyColor
    ctx.fill()
    ctx.strokeStyle = rules.colorOutline
    ctx.lineWidth = rules.outlineWidthPx
    ctx.stroke()
    const decorInk = darkenHex(bodyColor, rules.decorDarkenPercent)
    drawTintedDecor(ctx, this.images.source, decorInk, px, py, width, height, this.tintCache)
  }

  private machine(
    ctx: CanvasRenderingContext2D,
    machine: Machine,
    bodyColor: string,
    decor: HTMLImageElement | null,
    rules: PipelineRules,
    bracketStyle: SlotBracketStyle,
    options: {
      centerDecor?: boolean
      decorFacing?: Direction
      hidePortBracket?: (slot: PortSlot) => boolean
      /** Override decor tint (e.g. red arrows on fast tunnels). */
      decorInk?: string
      /** Draw red side rails along travel (fast tunnels, matching fast belts). */
      fastSideRails?: Direction
    } = {},
  ) {
    const { px, py, width, height } = machineRect(machine)
    this.drawMachineBody(
      ctx,
      machine,
      bodyColor,
      rules,
      bracketStyle,
      px,
      py,
      width,
      height,
      options.hidePortBracket,
    )
    if (options.fastSideRails) {
      drawFastTunnelSideRails(ctx, px, py, width, height, options.fastSideRails, rules)
    }
    const decorInk = options.decorInk ?? darkenHex(bodyColor, rules.decorDarkenPercent)
    if (options.decorFacing) {
      drawTintedDecorRotated(
        ctx,
        decor,
        decorInk,
        px,
        py,
        width,
        height,
        facingAngleRad(options.decorFacing),
        this.tintCache,
      )
      return
    }
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
    hidePortBracket?: (slot: PortSlot) => boolean,
  ) {
    // Ports under the body so the plate covers the bracket root.
    this.drawSlotBrackets(ctx, machine, bodyColor, rules, bracketStyle, hidePortBracket)
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
    hidePortBracket?: (slot: PortSlot) => boolean,
  ) {
    for (const slot of machine.slots) {
      if (hidePortBracket?.(slot)) continue
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
    motion: PacketMotionState,
  ) {
    const liveGlyph = combinerOutputGlyphId(rules, spec)
    if (liveGlyph) this.lastCombinerGlyphById.set(spec.id, liveGlyph)
    const glyphId = this.lastCombinerGlyphById.get(spec.id)
    if (!glyphId) return

    const crafting =
      spec.craftRemaining != null && spec.craftRemaining > 0 && Boolean(spec.recipeId)
    const worldCx = (machine.origin.x + machine.width / 2) * cellSize
    const worldCy = (machine.origin.y + machine.height / 2) * cellSize
    const space = glyphSpaceScale(cameraZoom, rules)
    // Machine overlays use pipeline `resource_glyph_size_px` (not per-element glyph_size_px).
    const glyphSize = rules.resourceGlyphSizePx
    // Wheel radius matches machine glyph space (world-scaled or screen-locked).
    const wheelRadius = glyphSize * 0.72

    ctx.save()
    ctx.translate(worldCx, worldCy)
    ctx.scale(space, space)
    if (crafting && spec.recipeId && spec.craftRemaining != null) {
      const recipeRate = resolveRecipeRatePerMinute(rules, spec.recipeId)
      const tickMs = rules.tickMs > 0 ? rules.tickMs : 250
      const tickPhase =
        motion.syncedAtMs > 0 ? Math.max(0, timeMs - motion.syncedAtMs) / tickMs : 0
      const progress = combinerCraftProgress(
        spec.craftRemaining,
        recipeRate,
        rules.tickMs,
        tickPhase,
      )
      drawCraftProgressWheel(ctx, wheelRadius, progress, rules)
    }
    this.drawResourceGlyph(ctx, glyphId, rules)
    ctx.restore()
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
    const space = glyphSpaceScale(cameraZoom, rules)
    ctx.save()
    ctx.translate(worldCx, worldCy)
    ctx.scale(space, space)
    ctx.translate(ox, oy)
    this.drawResourceGlyph(ctx, glyphId, rules)
    ctx.restore()
  }

  private drawResourceGlyph(ctx: CanvasRenderingContext2D, glyphId: string, rules: PipelineRules) {
    const size = rules.resourceGlyphSizePx
    const fill = elementFill(rules, glyphId) ?? rules.colorPacket
    const outline = resourceGlyphOutline(rules)
    if (glyphId === 'circle') {
      drawOutlinedResourceDisk(ctx, fill, 0, 0, size / 2, outline)
      return
    }
    drawOutlinedResourceGlyph(
      ctx,
      this.images.resources[glyphId] ?? null,
      fill,
      0,
      0,
      size,
      outline,
      this.tintCache,
    )
  }
}

function sourceGlyphId(spec: SourceRecord): string {
  return spec.role ?? spec.shape
}

type IndexedPort = { machineId: string; slot: PortSlot }

function footprintVisible(x: number, y: number, width: number, height: number, bounds?: CellBounds) {
  if (!bounds) return true
  return x <= bounds.maxX && x + width > bounds.minX && y <= bounds.maxY && y + height > bounds.minY
}

function indexPortSlots(machines: Machine[]) {
  const byCell = new Map<string, IndexedPort[]>()
  for (const machine of machines) {
    for (const slot of machine.slots) {
      const key = `${slot.cell.x},${slot.cell.y}`
      const list = byCell.get(key)
      const entry = { machineId: machine.id, slot }
      if (list) list.push(entry)
      else byCell.set(key, [entry])
    }
  }
  return byCell
}

function hideConnected(machineId: string, byCell: Map<string, IndexedPort[]>) {
  return (slot: PortSlot) => {
    const list = byCell.get(`${slot.cell.x},${slot.cell.y}`)
    if (!list) return false
    for (const other of list) {
      if (other.machineId === machineId) continue
      if (portsConnected(slot, other.slot)) return true
    }
    return false
  }
}

function logisticPortBracketHidden(
  machine: Machine,
  frameMachines: Machine[],
): ((slot: PortSlot) => boolean) | undefined {
  if (frameMachines.length === 0) return undefined
  return hideConnected(machine.id, indexPortSlots(frameMachines))
}

/** Primary output id for the active craft / pending eject, if any. */
function combinerOutputGlyphId(rules: PipelineRules, spec: CombinerRecord): string | null {
  if (spec.pendingOutputs?.length) return spec.pendingOutputs[0] ?? null
  if (!spec.recipeId) return null
  const el = rules.elements.elements.find((item) => item.id === spec.recipeId)
  if (!el) return spec.recipeId
  if (el.outputs?.length) return el.outputs[0] ?? el.id
  return el.id
}

/** Progress arc with white outer / black inner outline (screen-space). */
function drawCraftProgressWheel(
  ctx: CanvasRenderingContext2D,
  radius: number,
  progress: number,
  rules: PipelineRules,
) {
  const amount = Math.min(1, Math.max(0, progress))
  if (amount <= 0) return
  const start = -Math.PI / 2
  const end = start + amount * Math.PI * 2
  const core = Math.max(rules.resourceGlyphOutlineInnerWidthPx, 1)
  const ring = Math.max(rules.resourceGlyphOutlineOuterWidthPx, 0)
  ctx.save()
  ctx.lineCap = 'round'
  if (ring > 0 || core > 0) {
    ctx.beginPath()
    ctx.arc(0, 0, radius, start, end)
    ctx.strokeStyle = rules.resourceGlyphOutlineOuter
    ctx.lineWidth = core + ring * 2
    ctx.stroke()
  }
  if (core > 0) {
    ctx.beginPath()
    ctx.arc(0, 0, radius, start, end)
    ctx.strokeStyle = rules.resourceGlyphOutlineInner
    ctx.lineWidth = core
    ctx.stroke()
  }
  ctx.restore()
}

function machineRect(machine: Machine) {
  const px = machine.origin.x * cellSize
  const py = machine.origin.y * cellSize
  const width = machine.width * cellSize
  const height = machine.height * cellSize
  return { px, py, width, height }
}

/** Canvas radians for north-up decor SVGs (Y grows down). */
function facingAngleRad(facing: Direction): number {
  if (facing === 'east') return Math.PI / 2
  if (facing === 'south') return Math.PI
  if (facing === 'west') return -Math.PI / 2
  return 0
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
  const splitter = new Image()
  splitter.src = '/pipeline/splitter-decor.svg'
  splitter.onload = onLoad
  const tunnelEntrance = new Image()
  tunnelEntrance.src = '/pipeline/tunnel-entrance-decor.svg'
  tunnelEntrance.onload = onLoad
  const tunnelExit = new Image()
  tunnelExit.src = '/pipeline/tunnel-exit-decor.svg'
  tunnelExit.onerror = () => {
    tunnelExit.src = '/pipeline/tunnel-entrance-decor.svg'
  }
  tunnelExit.onload = onLoad
  const tunnelFastEntrance = new Image()
  tunnelFastEntrance.src = '/pipeline/tunnel-fast-entrance-decor.svg'
  tunnelFastEntrance.onerror = () => {
    tunnelFastEntrance.src = '/pipeline/tunnel-entrance-decor.svg'
  }
  tunnelFastEntrance.onload = onLoad
  const tunnelFastExit = new Image()
  tunnelFastExit.src = '/pipeline/tunnel-fast-exit-decor.svg'
  tunnelFastExit.onerror = () => {
    tunnelFastExit.src = '/pipeline/tunnel-exit-decor.svg'
  }
  tunnelFastExit.onload = onLoad
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
  return {
    coreFrame,
    coreGearOuter,
    coreGearInner,
    source,
    splitter,
    tunnelEntrance,
    tunnelExit,
    tunnelFastEntrance,
    tunnelFastExit,
    byKind,
    resources,
  }
}

function tunnelDecorImage(
  images: MachineDecorImages,
  role: TunnelPortalRole,
  fast: boolean,
): HTMLImageElement | null {
  if (fast) {
    return role === 'entrance'
      ? images.tunnelFastEntrance ?? images.tunnelEntrance
      : images.tunnelFastExit ?? images.tunnelExit
  }
  return role === 'entrance' ? images.tunnelEntrance : images.tunnelExit
}

/** Red rails parallel to travel on a fast tunnel body (same inset/color as fast belts). */
function drawFastTunnelSideRails(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  width: number,
  height: number,
  direction: Direction,
  rules: PipelineRules,
) {
  const inset = (rules.beltFastSideInsetPercent / 100) * cellSize
  if (inset <= 0 || inset * 2 >= Math.min(width, height)) return
  const stroke = Math.max(1.5, rules.beltChevronStrokePx * 0.55)
  ctx.save()
  ctx.beginPath()
  ctx.rect(px, py, width, height)
  ctx.clip()
  ctx.strokeStyle = rules.colorFastBeltChevron
  ctx.lineWidth = stroke
  ctx.lineCap = 'butt'
  const vertical = direction === 'north' || direction === 'south'
  if (vertical) {
    ctx.beginPath()
    ctx.moveTo(px + inset, py)
    ctx.lineTo(px + inset, py + height)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(px + width - inset, py)
    ctx.lineTo(px + width - inset, py + height)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(px, py + inset)
    ctx.lineTo(px + width, py + inset)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(px, py + height - inset)
    ctx.lineTo(px + width, py + height - inset)
    ctx.stroke()
  }
  ctx.restore()
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
  drawTintedImage(ctx, image, ink, x, y, width, height, cache)
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
  samples = CORE_GEAR_OUTLINE_SAMPLES,
) {
  const size = Math.min(width, height) * scale
  const cx = px + width / 2
  const cy = py + height / 2
  const x0 = cx - size / 2
  const y0 = cy - size / 2
  const outlineRadius = Math.max(outlineWidthPx * CORE_GEAR_OUTLINE_WIDTH_FACTOR, size * 0.03)
  for (let i = 0; i < samples; i++) {
    const a = (2 * Math.PI * i) / samples
    const ox = Math.cos(a) * outlineRadius
    const oy = Math.sin(a) * outlineRadius
    drawTintedDecorRotated(ctx, image, outlineInk, x0 + ox, y0 + oy, size, size, angleRad, cache)
  }
  drawTintedDecorRotated(ctx, image, fillInk, x0, y0, size, size, angleRad, cache)
}