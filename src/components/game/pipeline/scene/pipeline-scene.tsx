'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { BeltRecord, PipelineFrame, PipelineRules } from '../model/frame.ts'
import { CombinerMachine } from '../../../../../game-server/pipeline/machines/combiner-machine.ts'
import { TrashcanMachine } from '../../../../../game-server/pipeline/machines/trashcan-machine.ts'
import { setPlacementFrame, setPlacementRules } from '../placement-rules.ts'
import {
  getStructure,
  type StructureHoverGhost,
  type StructurePlacementSession,
  type StructurePlaceRequest,
  type StructurePreviewMachine,
} from '../structures'
import { machinesFromFrame } from '../placement-building-slots.ts'
import { occupancyFromFrame, setBeltCrossQuery, resetBeltCrossQuery } from './belt-cross.ts'
import { BeltEraseStroke } from './belt-erase-stroke.ts'
import { createBeltRedirectSession } from './belt-redirect.ts'
import {
  createTunnelUpgradeSession,
  tunnelSpeedChangeFromClick,
} from './tunnel-upgrade.ts'
import { clearTunnelPlacement, tunnelPlacementPending } from '../structures/tunnel.ts'
import { CoreMachine } from '../../../../../game-server/pipeline/machines/core-machine.ts'
import { loadSavedCamera, saveSavedCamera } from './camera-memory.ts'
import { GridCamera } from './grid-camera.ts'
import { BeltPainter } from './painters/belt-painter.ts'
import { cellSize, type CellBounds, GridPainter } from './painters/grid-painter.ts'
import { paintSceneLayer, type SceneLayer } from './scene-layer.ts'
import { sceneLod, sceneLodKey } from './scene-lod.ts'
import { loadMachineDecor, MachinePainter } from './painters/machine-painter.ts'
import { PacketPainter } from './painters/packet-painter.ts'
import { ReadoutPainter } from './painters/readout-painter.ts'
import { TunnelOccupancyPainter } from './painters/tunnel-occupancy-painter.ts'
import { createPacketMotionState, syncPacketMotion } from './packet-motion.ts'
import styles from '../../game-shell.module.css'

export type EditMode = 'create' | 'delete'

type ChunkBuyAnchor = {
  kind: 'chunk' | 'core'
  key: string
  cx: number
  cy: number
  x: number
  y: number
}

type Props = {
  roomId: string
  frame: PipelineFrame | null
  rules: PipelineRules | null
  editMode: EditMode
  structureId: string
  /** Signed-in player id; used to redirect owned belts. */
  userId?: string | null
  chunkCost: number | null
  /** Player coin balance; `null` when signed out. */
  coinBalance: number | null
  buyBusy?: boolean
  onContributeChunk: (coord: { cx: number; cy: number }, amount: number) => void
  onContributeCore?: (coord: { cx: number; cy: number }, amount: number) => void
  onPlace: (request: StructurePlaceRequest) => void
  /** `revert` undoes the optimistic hide if auth or the API rejects the removal. */
  onRemove: (cells: { x: number; y: number }[], options: { revert: () => void }) => void
  onToggleEditMode: () => void
  /** Bumped when sidebar Girar (or similar) changes place options. */
  placeEpoch?: number
}

const KEY_PAN_SPEED = 10
const PAN_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])
const MAX_DEVICE_PIXEL_RATIO = 2
const CAMERA_SAVE_DEBOUNCE_MS = 320

/** Phones spend most of their frame budget filling pixels. Cap the backing store there. */
function scenePixelRatio() {
  const dpr = window.devicePixelRatio || 1
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  return Math.min(dpr, coarse ? 1.5 : MAX_DEVICE_PIXEL_RATIO)
}

type ViewSize = { width: number; height: number; left: number; top: number }

/** Full-viewport grid. Core requirements sit in the room sidebar. */
export function PipelineScene({
  roomId,
  frame,
  rules,
  editMode,
  structureId,
  userId = null,
  chunkCost,
  coinBalance,
  buyBusy,
  onContributeChunk,
  onContributeCore,
  onPlace,
  onRemove,
  onToggleEditMode,
  placeEpoch = 0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef(new GridCamera(24, 24))
  const frameRef = useRef(frame)
  const rulesRef = useRef(rules)
  const editModeRef = useRef(editMode)
  const structureIdRef = useRef(structureId)
  const userIdRef = useRef(userId)
  const onToggleEditModeRef = useRef(onToggleEditMode)
  const originChunkRef = useRef<{ cx: number; cy: number } | null>(null)
  const images = useRef(loadMachineDecor(() => {}))
  const machinePainter = useRef(new MachinePainter(images.current))
  const gridPainter = useRef(new GridPainter())
  const beltPainter = useRef(new BeltPainter())
  const packetPainter = useRef(new PacketPainter())
  const tunnelOccupancyPainter = useRef(new TunnelOccupancyPainter())
  const readoutPainter = useRef(new ReadoutPainter())
  const packetMotion = useRef(createPacketMotionState())
  const groundLayer = useRef<SceneLayer | null>(null)
  const machineLayer = useRef<SceneLayer | null>(null)
  const viewSize = useRef<ViewSize>({ width: 1, height: 1, left: 0, top: 0 })
  const paintScheduled = useRef(false)
  const animateFrameId = useRef(0)
  const cameraSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roomIdRef = useRef(roomId)
  roomIdRef.current = roomId
  const buyAnchorSig = useRef('')
  /** Keeps the buy button visible while the pointer moves from the canvas onto the button. */
  const pinnedBuyChunk = useRef<{ cx: number; cy: number } | null>(null)
  const pinnedBuyCore = useRef<{ cx: number; cy: number } | null>(null)
  const [buyAnchors, setBuyAnchors] = useState<ChunkBuyAnchor[]>([])
  frameRef.current = frame
  rulesRef.current = rules
  setPlacementRules(rules)
  setPlacementFrame(frame)
  editModeRef.current = editMode
  structureIdRef.current = structureId
  userIdRef.current = userId
  onToggleEditModeRef.current = onToggleEditMode

  const flushCameraSave = (roomIdOverride?: string) => {
    if (cameraSaveTimer.current) {
      clearTimeout(cameraSaveTimer.current)
      cameraSaveTimer.current = null
    }
    const camera = cameraRef.current
    if (!camera.hasView) return
    const current = frameRef.current
    const palette = rulesRef.current
    if (!current || !palette) return
    const view = viewSize.current
    if (view.width < 1 || view.height < 1) return
    const origin = originChunkRef.current ?? current.originChunk ?? { cx: 0, cy: 0 }
    const chunkSize = palette.chunkSize
    const center = camera.worldCenter(view.width, view.height, cellSize)
    saveSavedCamera(roomIdOverride ?? roomIdRef.current, userIdRef.current, {
      worldX: center.x + origin.cx * chunkSize,
      worldY: center.y + origin.cy * chunkSize,
      zoom: camera.zoom,
    })
  }

  const scheduleCameraSave = () => {
    if (cameraSaveTimer.current) clearTimeout(cameraSaveTimer.current)
    cameraSaveTimer.current = setTimeout(() => {
      cameraSaveTimer.current = null
      flushCameraSave()
    }, CAMERA_SAVE_DEBOUNCE_MS)
  }

  const catalogDecorKey = [
    rules?.elements?.machines?.map((m) => `${m.id}:${m.decor}`).join('|') ?? '',
    rules?.elements?.elements?.map((e) => `${e.id}:${e.glyph}`).join('|') ?? '',
  ].join('//')

  const paint = () => {
    const canvas = canvasRef.current
    const current = frameRef.current
    const palette = rulesRef.current
    if (!canvas || !current || !palette) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const view = viewSize.current
    const ratio = scenePixelRatio()
    const nextWidth = Math.max(1, Math.floor(view.width * ratio))
    const nextHeight = Math.max(1, Math.floor(view.height * ratio))
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth
      canvas.height = nextHeight
    }
    const camera = cameraRef.current
    camera.setZoomLimits({ min: palette.cameraZoomMin, max: palette.cameraZoomMax })
    camera.applyInitialView(view.width, view.height, cellSize, () => {
      const saved = loadSavedCamera(roomIdRef.current, userIdRef.current)
      const origin = current.originChunk ?? { cx: 0, cy: 0 }
      const chunkSize = palette.chunkSize
      if (saved) {
        camera.zoom = Math.min(palette.cameraZoomMax, Math.max(palette.cameraZoomMin, saved.zoom))
        const localX = saved.worldX - origin.cx * chunkSize
        const localY = saved.worldY - origin.cy * chunkSize
        camera.centerOn(localX, localY, view.width, view.height, cellSize)
      } else {
        camera.setZoomToFitCells(
          palette.cameraEnterViewCells,
          view.width,
          view.height,
          cellSize,
        )
        const core = current.cores?.[0] ?? current.core
        const coreCenterX = core.x + CoreMachine.size / 2
        const coreCenterY = core.y + CoreMachine.size / 2
        camera.centerOn(coreCenterX, coreCenterY, view.width, view.height, cellSize)
      }
    })
    const timeMs = performance.now()
    syncPacketMotion(packetMotion.current, current, palette, timeMs, cellSize)
    const bounds = camera.visibleCellBounds(view.width, view.height, cellSize, 3)
    const visible = frameWithoutPendingRemovals(current, pendingRemovals.current)
    const strokePreview = placement.current?.previewBelts() ?? []
    const hoverGhost =
      editModeRef.current === 'create' && !placement.current && !eraseStroke.current
        ? hoverStructureGhost(structureIdRef.current, current, camera, lastPointer.current)
        : null
    const preview = [...strokePreview, ...(hoverGhost?.belts ?? [])]
    const belts = cullBelts(visible.belts, bounds)
    const previewVisible = cullBelts(preview, bounds)
    const previewKeys = new Set(previewVisible.map((belt) => cellKey(belt)))
    const underPreview = belts.filter((belt) => !previewKeys.has(cellKey(belt)))
    const lod = sceneLod(camera.zoom, palette)
    const lodKey = sceneLodKey(lod)
    const viewKey = `${Math.round(view.width)}x${Math.round(view.height)}@${ratio}`
    const cameraKey = `${camera.x.toFixed(3)}|${camera.y.toFixed(3)}|${camera.zoom.toFixed(4)}`
    const paletteKey = staticPaletteKey(palette)
    const showGrid = camera.zoom >= palette.gridVisibleMinZoom
    groundLayer.current = paintSceneLayer(
      groundLayer.current,
      `${viewKey}|${cameraKey}|${paletteKey}|g${showGrid ? 1 : 0}|${hashBelts(belts)}|${hashChunks(visible)}`,
      view.width,
      view.height,
      ratio,
      (layer) => {
        withCamera(layer, camera, ratio, () => {
          gridPainter.current.draw(layer, visible, palette, camera.zoom, bounds)
          beltPainter.current.drawTracks(layer, belts, palette)
        })
      },
    )
    machineLayer.current = paintSceneLayer(
      machineLayer.current,
      `${viewKey}|${cameraKey}|${paletteKey}|${lodKey}|${machinePainter.current.decorStamp()}|${hashMachines(visible)}`,
      view.width,
      view.height,
      ratio,
      (layer) => {
        withCamera(layer, camera, ratio, () => {
          machinePainter.current.draw(
            layer,
            visible,
            palette,
            camera.zoom,
            timeMs,
            packetMotion.current,
            bounds,
            'static',
            lod.machines,
          )
        })
      },
    )

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(groundLayer.current.canvas, 0, 0)
    withCamera(ctx, camera, ratio, () => {
      if (lod.beltChevrons) beltPainter.current.drawChevrons(ctx, underPreview, palette, timeMs)
      if (previewVisible.length > 0) {
        if (lod.beltChevrons) beltPainter.current.draw(ctx, previewVisible, palette, timeMs)
        else beltPainter.current.drawTracks(ctx, previewVisible, palette)
      }
      const eraseBox = eraseStroke.current?.bounds()
      if (eraseBox) {
        ctx.save()
        ctx.globalAlpha = 0.22
        ctx.fillStyle = palette.colorWarning
        ctx.fillRect(
          eraseBox.minX * cellSize,
          eraseBox.minY * cellSize,
          (eraseBox.maxX - eraseBox.minX + 1) * cellSize,
          (eraseBox.maxY - eraseBox.minY + 1) * cellSize,
        )
        ctx.restore()
      }
      const drawnBelts = [...underPreview, ...previewVisible]
      const packets = visible.packets.filter(
        (packet) =>
          packet.x >= bounds.minX &&
          packet.x <= bounds.maxX &&
          packet.y >= bounds.minY &&
          packet.y <= bounds.maxY,
      )
      const packetFrame = packets.length === visible.packets.length ? visible : { ...visible, packets }
      packetPainter.current.draw(
        ctx,
        packetFrame,
        drawnBelts,
        palette,
        packetMotion.current,
        timeMs,
        lod,
      )
      tunnelOccupancyPainter.current.drawUnderground(
        ctx,
        visible,
        palette,
        timeMs,
        lod,
        packetMotion.current,
      )
    })
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(machineLayer.current.canvas, 0, 0)
    withCamera(ctx, camera, ratio, () => {
      machinePainter.current.draw(
        ctx,
        visible,
        palette,
        camera.zoom,
        timeMs,
        packetMotion.current,
        bounds,
        'dynamic',
        lod.machines,
      )
      tunnelOccupancyPainter.current.drawPortalPulse(
        ctx,
        visible,
        palette,
        timeMs,
        lod,
        bounds,
        packetMotion.current,
      )
      const structureHints =
        editModeRef.current === 'create'
          ? (getStructure(structureIdRef.current)?.placementHints?.() ?? [])
          : []
      const hintCells = [
        ...structureHints,
        ...(hoverGhost?.hintCells ?? []),
        ...(editModeRef.current === 'create' ? (placement.current?.previewHintCells?.() ?? []) : []),
      ]
      if (hintCells.length > 0) {
        gridPainter.current.drawHintCells(ctx, hintCells, current, palette.colorHighlight)
      }
      const machineGhosts: StructurePreviewMachine[] = [
        ...(hoverGhost?.machines ?? []),
        ...(placement.current?.previewMachines?.() ?? []),
      ]
      const singleGhost =
        hoverGhost?.machine ??
        (editModeRef.current === 'create' ? placement.current?.previewMachine?.() : null)
      if (singleGhost) machineGhosts.push(singleGhost)
      for (const ghost of machineGhosts) {
        machinePainter.current.drawMachineGhost(ctx, ghost, palette)
      }
      gridPainter.current.drawPreviewOverlay(ctx, current, palette)
      const hover =
        pinnedBlame.current ??
        hoverLabel(current, camera, lastPointer.current, pendingRemovals.current)
      readoutPainter.current.draw(ctx, current, palette, hover)
    })
    syncBuyAnchors(current, palette, camera, view)
  }

  const syncBuyAnchors = (
    current: PipelineFrame,
    palette: PipelineRules,
    camera: GridCamera,
    view: ViewSize,
  ) => {
    const pinned = pinnedBuyChunk.current
    if (pinned) {
      const key = `${pinned.cx},${pinned.cy}`
      const stillForSale = (current.previewChunks ?? []).some(
        (item) => `${item.cx},${item.cy}` === key,
      )
      if (!stillForSale) pinnedBuyChunk.current = null
    }
    const pinnedCore = pinnedBuyCore.current
    if (pinnedCore) {
      const key = `${pinnedCore.cx},${pinnedCore.cy}`
      const stillOptional = (current.optionalCoreChunkKeys ?? []).includes(key)
      if (!stillOptional) pinnedBuyCore.current = null
    }
    const hoveredPreview =
      pinnedBuyChunk.current ??
      previewChunkUnderPointer(current, palette, camera, lastPointer.current)
    const hoveredCore =
      pinnedBuyCore.current ??
      optionalCoreChunkUnderPointer(current, palette, camera, lastPointer.current)
    let next: ChunkBuyAnchor[] = []
    if (hoveredPreview) {
      next = previewBuyAnchor(current, palette, camera, view, hoveredPreview).map((item) => ({
        ...item,
        kind: 'chunk' as const,
      }))
    } else if (hoveredCore && onContributeCore) {
      next = previewBuyAnchor(current, palette, camera, view, hoveredCore).map((item) => ({
        ...item,
        kind: 'core' as const,
      }))
    }
    const signature = next.map((item) => `${item.kind}:${item.key}:${item.x}:${item.y}`).join('|')
    if (signature === buyAnchorSig.current) return
    buyAnchorSig.current = signature
    setBuyAnchors(next)
  }

  const requestPaint = () => {
    if (paintScheduled.current) return
    paintScheduled.current = true
    requestAnimationFrame(() => {
      paintScheduled.current = false
      paint()
    })
  }

  const previousRoomIdRef = useRef(roomId)
  useEffect(() => {
    const previous = previousRoomIdRef.current
    if (previous !== roomId) {
      flushCameraSave(previous)
      cameraRef.current.resetView()
      originChunkRef.current = null
      previousRoomIdRef.current = roomId
    }
  }, [roomId])

  useEffect(() => {
    const onPageHide = () => flushCameraSave()
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      flushCameraSave()
      if (cameraSaveTimer.current) {
        clearTimeout(cameraSaveTimer.current)
        cameraSaveTimer.current = null
      }
    }
  }, [])

  useEffect(() => {
    images.current = loadMachineDecor(() => requestPaint())
    machinePainter.current = new MachinePainter(images.current)
  }, [])

  useEffect(() => {
    if (!catalogDecorKey) return
    const palette = rulesRef.current
    const kinds = palette?.elements?.machines
    const elements = palette?.elements?.elements
    if (!kinds?.length && !elements?.length) return
    images.current = loadMachineDecor(() => requestPaint(), kinds, elements, palette)
    machinePainter.current = new MachinePainter(images.current)
    packetPainter.current.setResourceGlyphs(images.current.resources)
    tunnelOccupancyPainter.current.setResourceGlyphs(images.current.resources)
    requestPaint()
  }, [catalogDecorKey])

  useEffect(() => {
    if (!frame) return
    const origin = frame.originChunk ?? { cx: 0, cy: 0 }
    const previous = originChunkRef.current
    const chunkSize = rulesRef.current?.chunkSize ?? 24
    if (previous) {
      const dx = (previous.cx - origin.cx) * chunkSize
      const dy = (previous.cy - origin.cy) * chunkSize
      if (dx !== 0 || dy !== 0) {
        cameraRef.current.compensateOriginShift(dx, dy, cellSize)
      }
      cameraRef.current.setWorldSize(frame.width, frame.height, { keepView: true })
    } else {
      cameraRef.current.setWorldSize(frame.width, frame.height)
    }
    originChunkRef.current = { ...origin }
    requestPaint()
  }, [frame?.width, frame?.height, frame?.originChunk?.cx, frame?.originChunk?.cy])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const syncView = () => {
      const rect = canvas.getBoundingClientRect()
      viewSize.current = { width: rect.width, height: rect.height, left: rect.left, top: rect.top }
      requestPaint()
    }
    syncView()

    const observer = new ResizeObserver(syncView)
    observer.observe(canvas)
    window.addEventListener('scroll', syncView, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', syncView, true)
    }
  }, [])

  useEffect(() => {
    const loop = () => {
      if (!document.hidden) paint()
      animateFrameId.current = requestAnimationFrame(loop)
    }
    const onVisible = () => {
      if (!document.hidden) paint()
    }
    document.addEventListener('visibilitychange', onVisible)
    animateFrameId.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animateFrameId.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  const pinnedBlame = useRef<{ x: number; y: number; nickname: string } | null>(null)
  const longPress = useRef<{
    timer: ReturnType<typeof setTimeout> | null
    origin: { x: number; y: number } | null
    fired: boolean
  }>({ timer: null, origin: null, fired: false })
  const placement = useRef<StructurePlacementSession | null>(null)
  const eraseStroke = useRef<BeltEraseStroke | null>(null)
  const pendingRemovals = useRef(emptyPendingRemovals())
  const pan = useRef<{ x: number; y: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const heldKeys = useRef(new Set<string>())

  const syncErasePreview = () => {
    requestPaint()
  }

  const syncPendingRemovals = () => {
    const current = frameRef.current
    if (!current) return
    const pending = pendingRemovals.current
    for (const key of [...pending.belts]) {
      const cell = parseCellKey(key)
      if (!cell) continue
      if (!current.belts.some((belt) => belt.x === cell.x && belt.y === cell.y)) pending.belts.delete(key)
    }
    for (const id of [...pending.combinerIds]) {
      if (!(current.combiners ?? []).some((machine) => machine.id === id)) pending.combinerIds.delete(id)
    }
    for (const id of [...pending.splitterIds]) {
      if (!(current.splitters ?? []).some((machine) => machine.id === id)) pending.splitterIds.delete(id)
    }
    for (const id of [...pending.tunnelPairIds]) {
      if (!(current.tunnels ?? []).some((portal) => portal.pairId === id)) pending.tunnelPairIds.delete(id)
    }
    for (const id of [...pending.trashcanIds]) {
      if (!(current.trashcans ?? []).some((machine) => machine.id === id)) pending.trashcanIds.delete(id)
    }
  }

  const revertPendingRemovals = () => {
    pendingRemovals.current = emptyPendingRemovals()
    requestPaint()
  }

  const commitErase = () => {
    const stroke = eraseStroke.current
    eraseStroke.current = null
    if (!stroke) return
    const current = frameRef.current
    if (!current) {
      revertPendingRemovals()
      return
    }
    const strokeCells = stroke.cells()
    const beltTargets = strokeCells.filter((cell) =>
      current.belts.some((belt) => belt.x === cell.x && belt.y === cell.y),
    )
    const combinerTargets: { x: number; y: number }[] = []
    const seenCombiners = new Set<string>()
    for (const cell of strokeCells) {
      const hit = (current.combiners ?? []).find((machine) => {
        const size = CombinerMachine.sizeFor(machine.machineId, machine.facing)
        return (
          cell.x >= machine.x &&
          cell.x < machine.x + size.width &&
          cell.y >= machine.y &&
          cell.y < machine.y + size.height
        )
      })
      if (!hit || seenCombiners.has(hit.id)) continue
      seenCombiners.add(hit.id)
      combinerTargets.push({ x: hit.x, y: hit.y })
    }
    const splitterTargets: { x: number; y: number }[] = []
    const seenSplitters = new Set<string>()
    for (const cell of strokeCells) {
      const hit = (current.splitters ?? []).find(
        (machine) => machine.x === cell.x && machine.y === cell.y,
      )
      if (!hit || seenSplitters.has(hit.id)) continue
      seenSplitters.add(hit.id)
      splitterTargets.push({ x: hit.x, y: hit.y })
    }
    const tunnelTargets: { x: number; y: number }[] = []
    const seenTunnelPairs = new Set<string>()
    for (const cell of strokeCells) {
      const hit = (current.tunnels ?? []).find(
        (portal) => portal.x === cell.x && portal.y === cell.y,
      )
      if (!hit || seenTunnelPairs.has(hit.pairId)) continue
      seenTunnelPairs.add(hit.pairId)
      tunnelTargets.push({ x: hit.x, y: hit.y })
    }
    const trashcanTargets: { x: number; y: number }[] = []
    const seenTrashcans = new Set<string>()
    for (const cell of strokeCells) {
      const hit = (current.trashcans ?? []).find((machine) =>
        cellInTrashcanFootprint(machine, cell),
      )
      if (!hit || seenTrashcans.has(hit.id)) continue
      seenTrashcans.add(hit.id)
      trashcanTargets.push({ x: hit.x, y: hit.y })
    }
    const targets = [
      ...beltTargets,
      ...combinerTargets,
      ...splitterTargets,
      ...tunnelTargets,
      ...trashcanTargets,
    ]
    if (targets.length === 0) {
      requestPaint()
      return
    }
    const pending = pendingRemovals.current
    for (const cell of beltTargets) pending.belts.add(cellKey(cell))
    for (const id of seenCombiners) pending.combinerIds.add(id)
    for (const id of seenSplitters) pending.splitterIds.add(id)
    for (const id of seenTunnelPairs) pending.tunnelPairIds.add(id)
    for (const id of seenTrashcans) pending.trashcanIds.add(id)
    onRemove(targets, { revert: revertPendingRemovals })
    requestPaint()
  }

  useEffect(() => {
    syncPendingRemovals()
    requestPaint()
  }, [frame])

  useEffect(() => {
    requestPaint()
  }, [placeEpoch])

  useEffect(() => {
    setBeltCrossQuery({
      maxGap: () => rulesRef.current?.tunnelMaxGap ?? 8,
      occupancy: () => occupancyFromFrame(frameRef.current),
      belts: () => frameRef.current?.belts ?? [],
      ports: () => {
        const frame = frameRef.current
        if (!frame) return []
        return machinesFromFrame(frame).flatMap((machine) => machine.slots)
      },
    })
    const typingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (typingTarget(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'e' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        onToggleEditModeRef.current()
        return
      }
      if (key === 'r' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        const structure = getStructure(structureIdRef.current)
        structure?.rotate?.()
        requestPaint()
        return
      }
      if (!PAN_KEYS.has(key)) return
      event.preventDefault()
      heldKeys.current.add(key)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      heldKeys.current.delete(event.key.toLowerCase())
    }

    const onBlur = () => {
      heldKeys.current.clear()
    }

    let frameId = 0
    const tick = () => {
      const keys = heldKeys.current
      if (keys.size > 0) {
        let dx = 0
        let dy = 0
        if (keys.has('a') || keys.has('arrowleft')) dx += KEY_PAN_SPEED
        if (keys.has('d') || keys.has('arrowright')) dx -= KEY_PAN_SPEED
        if (keys.has('w') || keys.has('arrowup')) dy += KEY_PAN_SPEED
        if (keys.has('s') || keys.has('arrowdown')) dy -= KEY_PAN_SPEED
        if (dx !== 0 || dy !== 0) {
          cameraRef.current.pan(dx, dy)
          scheduleCameraSave()
        }
      }
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      cancelAnimationFrame(frameId)
      resetBeltCrossQuery()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const localCell = (event: { clientX: number; clientY: number }) => {
    const current = frameRef.current
    if (!current) return null
    const view = viewSize.current
    const cell = cameraRef.current.cellAt(event.clientX - view.left, event.clientY - view.top, cellSize)
    if (cell.x < 0 || cell.y < 0 || cell.x >= current.width || cell.y >= current.height) return null
    return cell
  }

  const cancelLongPress = () => {
    if (longPress.current.timer) clearTimeout(longPress.current.timer)
    longPress.current = { timer: null, origin: null, fired: false }
  }

  const beltAt = (current: PipelineFrame, cell: { x: number; y: number }) =>
    current.belts.find(
      (belt) =>
        belt.x === cell.x &&
        belt.y === cell.y &&
        !pendingRemovals.current.belts.has(cellKey(belt)),
    )

  const scheduleLongPress = (belt: { x: number; y: number; authorNickname: string }, x: number, y: number) => {
    cancelLongPress()
    longPress.current.origin = { x, y }
    longPress.current.timer = setTimeout(() => {
      pinnedBlame.current = { x: belt.x, y: belt.y, nickname: belt.authorNickname }
      longPress.current.fired = true
      longPress.current.timer = null
      placement.current = null
      requestPaint()
    }, 450)
  }

  const trackEraseCell = (cell: { x: number; y: number }) => {
    if (!eraseStroke.current?.push(cell)) return
    syncErasePreview()
  }

  const beginPan = (event: { clientX: number; clientY: number }) => {
    pan.current = { x: event.clientX, y: event.clientY }
    placement.current = null
    if (eraseStroke.current) {
      eraseStroke.current = null
      revertPendingRemovals()
    }
    cancelLongPress()
  }

  const beginErase = (event: ReactPointerEvent<HTMLCanvasElement>, cell: { x: number; y: number }) => {
    event.preventDefault()
    canvasRef.current?.setPointerCapture(event.pointerId)
    eraseStroke.current = new BeltEraseStroke()
    trackEraseCell(cell)
    placement.current = null
    cancelLongPress()
  }

  const beginPlace = (event: ReactPointerEvent<HTMLCanvasElement>, cell: { x: number; y: number } | null) => {
    const current = frameRef.current
    const structure = getStructure(structureIdRef.current)
    cancelLongPress()
    if (!cell || !structure) {
      pinnedBlame.current = null
      placement.current = null
      requestPaint()
      return
    }
    event.preventDefault()
    canvasRef.current?.setPointerCapture(event.pointerId)
    const belt = current ? beltAt(current, cell) : undefined
    const machineBlame = current && !belt ? machineBlameAt(current, cell, pendingRemovals.current) : null
    const blameTarget = belt ?? machineBlame
    if (blameTarget) scheduleLongPress(blameTarget, event.clientX, event.clientY)
    else pinnedBlame.current = null
    const ownerId = userIdRef.current
    if (
      (structureIdRef.current === 'belt' || structureIdRef.current === 'fast_belt') &&
      belt &&
      ownerId &&
      belt.authorId === ownerId
    ) {
      const placeSpeed =
        structureIdRef.current === 'fast_belt'
          ? (rulesRef.current?.beltSpeedFast ?? 2)
          : 1
      placement.current = createBeltRedirectSession(belt, { placeSpeed })
      eraseStroke.current = null
      return
    }
    if (
      (structureIdRef.current === 'tunnel' || structureIdRef.current === 'fast_tunnel') &&
      current &&
      ownerId &&
      !tunnelPlacementPending()
    ) {
      const change = tunnelSpeedChangeFromClick(
        current,
        cell,
        ownerId,
        rulesRef.current,
        structureIdRef.current,
      )
      if (change) {
        clearTunnelPlacement()
        placement.current = createTunnelUpgradeSession(change)
        eraseStroke.current = null
        return
      }
    }
    const session = structure.createSession()
    session.push(cell)
    placement.current = session
    eraseStroke.current = null
  }

  return (
    <div className={styles.sceneStack}>
      <canvas
        ref={canvasRef}
        className={`${styles.pipelineCanvas} ${
          editMode === 'delete' ? styles.pipelineCanvasDelete : styles.pipelineCanvasCreate
        }`}
        onContextMenu={(event) => {
          event.preventDefault()
        }}
        onPointerDown={(event) => {
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          if (event.button === 1 || event.button === 2 || event.shiftKey || pointers.current.size > 1) {
            if (event.button === 2) event.preventDefault()
            beginPan(event)
            return
          }
          if (event.button !== 0) return
          const cell = localCell(event)
          if (editModeRef.current === 'delete') {
            if (!cell) return
            beginErase(event, cell)
            return
          }
          beginPlace(event, cell)
        }}
        onPointerMove={(event) => {
          const view = viewSize.current
          lastPointer.current = { x: event.clientX - view.left, y: event.clientY - view.top }
          if (pointers.current.size >= 2) {
            const points = [...pointers.current.values()]
            const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
            const previous = pinchDistance.current
            if (previous) {
              cameraRef.current.zoomAt(view.width / 2, view.height / 2, distance / previous, cellSize)
              scheduleCameraSave()
            }
            pinchDistance.current = distance
            return
          }
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          if (pan.current) {
            cameraRef.current.pan(event.clientX - pan.current.x, event.clientY - pan.current.y)
            pan.current = { x: event.clientX, y: event.clientY }
            scheduleCameraSave()
            return
          }
          const cell = localCell(event)
          if (longPress.current.origin && longPress.current.timer) {
            const moved = Math.hypot(
              event.clientX - longPress.current.origin.x,
              event.clientY - longPress.current.origin.y,
            )
            if (moved > 8) cancelLongPress()
          }
          if (cell && eraseStroke.current) trackEraseCell(cell)
          else if (cell && placement.current) {
            if (placement.current.push(cell)) cancelLongPress()
          }
          requestPaint()
        }}
        onPointerUp={(event) => {
          if (eraseStroke.current || placement.current) {
            canvasRef.current?.releasePointerCapture(event.pointerId)
          }
          pointers.current.delete(event.pointerId)
          pinchDistance.current = null
          pan.current = null
          if (eraseStroke.current) {
            commitErase()
            return
          }
          if (longPress.current.fired) {
            placement.current = null
            cancelLongPress()
            return
          }
          cancelLongPress()
          const done = placement.current
          placement.current = null
          const request = done?.finish() ?? null
          if (request) onPlace(request)
        }}
        onPointerLeave={(event) => {
          // Keep placement capture active; only erase cancels when leaving the canvas.
          if (eraseStroke.current) {
            canvasRef.current?.releasePointerCapture(event.pointerId)
            eraseStroke.current = null
            revertPendingRemovals()
          }
          const next = event.relatedTarget
          if (next instanceof Element && next.closest(`.${styles.chunkBuyButton}`)) {
            return
          }
          lastPointer.current = null
          pinnedBuyChunk.current = null
          pinnedBuyCore.current = null
          requestPaint()
        }}
        onWheel={(event) => {
          event.preventDefault()
          const view = viewSize.current
          const factor = event.deltaY < 0 ? 1.08 : 0.92
          cameraRef.current.zoomAt(event.clientX - view.left, event.clientY - view.top, factor, cellSize)
          scheduleCameraSave()
          requestPaint()
        }}
      />
      {buyAnchors.length > 0 ? (
        <div
          className={styles.chunkBuyLayer}
          aria-label={
            buyAnchors[0]?.kind === 'core' ? 'Aportar em núcleo opcional' : 'Aportar em trechos'
          }
        >
          {buyAnchors.map((anchor) => {
            const isCore = anchor.kind === 'core'
            const targetCost = isCore
              ? (rules?.optionalCoreCost ?? 0)
              : (chunkCost ?? 0)
            if (targetCost < 1) return null
            const pledges = isCore ? frame?.corePledges : frame?.chunkPledges
            const paid =
              pledges?.find((pledge) => pledge.cx === anchor.cx && pledge.cy === anchor.cy)?.paid ?? 0
            const remaining = Math.max(0, targetCost - paid)
            const canBuyNow = coinBalance == null || coinBalance >= remaining
            const quickAmount = canBuyNow ? remaining : coinBalance
            const quickLabel = canBuyNow ? 'Comprar' : 'Aportar saldo'
            const quickDisabled =
              buyBusy || remaining < 1 || (coinBalance != null && quickAmount < 1)
            const contribute = isCore ? onContributeCore : onContributeChunk
            if (!contribute) return null
            return (
              <form
                key={`${anchor.kind}:${anchor.key}`}
                className={styles.chunkBuyForm}
                style={{ left: anchor.x, top: anchor.y }}
                onPointerEnter={() => {
                  if (isCore) pinnedBuyCore.current = { cx: anchor.cx, cy: anchor.cy }
                  else pinnedBuyChunk.current = { cx: anchor.cx, cy: anchor.cy }
                }}
                onPointerLeave={() => {
                  if (isCore) pinnedBuyCore.current = null
                  else pinnedBuyChunk.current = null
                  lastPointer.current = null
                  requestPaint()
                }}
                onSubmit={(event) => {
                  event.preventDefault()
                  const data = new FormData(event.currentTarget)
                  const amount = Number(data.get('amount'))
                  if (!Number.isInteger(amount) || amount < 1) return
                  contribute({ cx: anchor.cx, cy: anchor.cy }, amount)
                }}
              >
                <span>
                  {isCore ? <strong>Núcleo</strong> : null}
                  {isCore ? ' · ' : null}
                  {paid}/{targetCost} moedas
                </span>
                <div className={styles.chunkPledgeRow}>
                  <input
                    className={styles.chunkPledgeInput}
                    name="amount"
                    type="number"
                    min={1}
                    max={remaining || undefined}
                    step={1}
                    defaultValue={1}
                    aria-label="Moedas para aportar"
                    disabled={buyBusy || remaining < 1}
                  />
                  <button className={styles.chunkPledgeSubmit} type="submit" disabled={buyBusy || remaining < 1}>
                    Aportar
                  </button>
                </div>
                <button
                  className={`${styles.chunkPledgeQuick} ${styles.chunkBuyButton}`}
                  type="button"
                  disabled={quickDisabled}
                  onClick={() => {
                    if (!Number.isInteger(quickAmount) || quickAmount < 1) return
                    contribute({ cx: anchor.cx, cy: anchor.cy }, quickAmount)
                  }}
                >
                  {quickLabel}
                </button>
              </form>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

const pinchDistance = { current: null as number | null }

function withCamera(
  ctx: CanvasRenderingContext2D,
  camera: GridCamera,
  ratio: number,
  draw: () => void,
) {
  ctx.save()
  ctx.setTransform(ratio, 0, 0, ratio, camera.x * ratio, camera.y * ratio)
  ctx.scale(camera.zoom, camera.zoom)
  draw()
  ctx.restore()
}

function staticPaletteKey(rules: PipelineRules) {
  return [
    rules.colorBackground,
    rules.colorGrid,
    rules.colorMuted,
    rules.colorBelt,
    rules.colorFastBelt,
    rules.colorFastBeltChevron,
    rules.colorBeltChevron,
    rules.colorCore,
    rules.colorSource,
    rules.colorSplitter,
    rules.colorTunnel,
    rules.colorFastTunnel,
    rules.colorOutline,
    rules.colorAccent,
    rules.outlineWidthPx,
    rules.decorDarkenPercent,
    rules.beltChevronStrokePx,
    rules.beltFastSideInsetPercent,
    rules.lodDetailMinZoom,
    rules.lodStructureMinZoom,
  ].join('|')
}

function hashMix(h: number, n: number) {
  return Math.imul(h, 16777619) ^ (n | 0)
}

function hashLabel(h: number, value: string) {
  let next = h
  for (let i = 0; i < value.length; i++) next = hashMix(next, value.charCodeAt(i))
  return next
}

function hashBelts(belts: BeltRecord[]) {
  let h = belts.length
  for (const belt of belts) {
    h = hashMix(h, belt.x)
    h = hashMix(h, belt.y)
    h = hashMix(h, belt.direction.charCodeAt(0))
    h = hashMix(h, belt.speed ?? 1)
  }
  return (h >>> 0).toString(16)
}

function hashChunks(frame: PipelineFrame) {
  let h = frame.width
  h = hashMix(h, frame.height)
  h = hashMix(h, frame.originChunk?.cx ?? 0)
  h = hashMix(h, frame.originChunk?.cy ?? 0)
  for (const chunk of frame.ownedChunks ?? []) {
    h = hashMix(h, chunk.cx)
    h = hashMix(h, chunk.cy)
  }
  for (const chunk of frame.previewChunks ?? []) {
    h = hashMix(h, chunk.cx)
    h = hashMix(h, chunk.cy)
  }
  return (h >>> 0).toString(16)
}

/**
 * Layout stamp for the cached machine bitmap. Walks `machinesFromFrame` so a new
 * machine kind invalidates the layer as soon as it is on that list.
 */
function hashMachines(frame: PipelineFrame) {
  let h = 0
  for (const machine of machinesFromFrame(frame)) {
    h = hashLabel(h, machine.kind)
    h = hashLabel(h, machine.id)
    h = hashMix(h, machine.origin.x)
    h = hashMix(h, machine.origin.y)
    h = hashMix(h, machine.width)
    h = hashMix(h, machine.height)
    const detail = machine as {
      facing?: string
      direction?: string
      shape?: string
      machineId?: string
      speed?: number
      role?: string
    }
    if (detail.facing) h = hashLabel(h, detail.facing)
    if (detail.direction) h = hashLabel(h, detail.direction)
    if (detail.shape) h = hashLabel(h, detail.shape)
    if (detail.machineId) h = hashLabel(h, detail.machineId)
    if (typeof detail.speed === 'number') h = hashMix(h, detail.speed)
    if (detail.role) h = hashLabel(h, detail.role)
    for (const slot of machine.slots) {
      h = hashMix(h, slot.cell.x)
      h = hashMix(h, slot.cell.y)
      h = hashLabel(h, slot.role)
      h = hashLabel(h, slot.travel)
    }
  }
  return (h >>> 0).toString(16)
}

function cullBelts(belts: BeltRecord[], bounds: CellBounds) {
  return belts.filter(
    (belt) =>
      belt.x >= bounds.minX && belt.x <= bounds.maxX && belt.y >= bounds.minY && belt.y <= bounds.maxY,
  )
}

function hoverStructureGhost(
  structureId: string,
  frame: PipelineFrame,
  camera: GridCamera,
  pointer: { x: number; y: number } | null,
): StructureHoverGhost | null {
  if (!pointer) return null
  const structure = getStructure(structureId)
  if (!structure?.hoverGhost) return null
  const cell = camera.cellAt(pointer.x, pointer.y, cellSize)
  if (cell.x < 0 || cell.y < 0 || cell.x >= frame.width || cell.y >= frame.height) return null
  return structure.hoverGhost(cell, frame)
}

function hoverLabel(
  frame: PipelineFrame,
  camera: GridCamera,
  pointer: { x: number; y: number } | null,
  pending: PendingRemovals,
) {
  if (!pointer) return null
  const cell = camera.cellAt(pointer.x, pointer.y, cellSize)
  if (cell.x < 0 || cell.y < 0 || cell.x >= frame.width || cell.y >= frame.height) return null
  const belt = frame.belts.find(
    (item) => item.x === cell.x && item.y === cell.y && !pending.belts.has(cellKey(item)),
  )
  if (belt?.authorNickname) {
    return { x: belt.x, y: belt.y, nickname: belt.authorNickname }
  }
  const machine = machineBlameAt(frame, cell, pending)
  if (machine) {
    return { x: machine.x, y: machine.y, nickname: machine.authorNickname }
  }
  return null
}

function machineBlameAt(
  frame: PipelineFrame,
  cell: { x: number; y: number },
  pending: PendingRemovals,
): { x: number; y: number; authorNickname: string } | null {
  for (const spec of frame.combiners ?? []) {
    if (pending.combinerIds.has(spec.id)) continue
    const { width, height } = CombinerMachine.sizeFor(spec.machineId, spec.facing)
    const covers =
      cell.x >= spec.x && cell.x < spec.x + width && cell.y >= spec.y && cell.y < spec.y + height
    if (covers && spec.authorNickname) {
      return { x: cell.x, y: cell.y, authorNickname: spec.authorNickname }
    }
  }
  for (const spec of frame.splitters ?? []) {
    if (pending.splitterIds.has(spec.id)) continue
    if (spec.x === cell.x && spec.y === cell.y && spec.authorNickname) {
      return { x: cell.x, y: cell.y, authorNickname: spec.authorNickname }
    }
  }
  for (const spec of frame.tunnels ?? []) {
    if (pending.tunnelPairIds.has(spec.pairId)) continue
    if (spec.x === cell.x && spec.y === cell.y && spec.authorNickname) {
      return { x: cell.x, y: cell.y, authorNickname: spec.authorNickname }
    }
  }
  return null
}

function cellKey(cell: { x: number; y: number }) {
  return `${cell.x},${cell.y}`
}

function parseCellKey(key: string) {
  const [xs, ys] = key.split(',')
  const x = Number(xs)
  const y = Number(ys)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

type PendingRemovals = {
  belts: Set<string>
  combinerIds: Set<string>
  splitterIds: Set<string>
  tunnelPairIds: Set<string>
  trashcanIds: Set<string>
}

function emptyPendingRemovals(): PendingRemovals {
  return {
    belts: new Set(),
    combinerIds: new Set(),
    splitterIds: new Set(),
    tunnelPairIds: new Set(),
    trashcanIds: new Set(),
  }
}

function cellInTrashcanFootprint(
  machine: { x: number; y: number },
  cell: { x: number; y: number },
): boolean {
  return (
    cell.x >= machine.x &&
    cell.x < machine.x + TrashcanMachine.width &&
    cell.y >= machine.y &&
    cell.y < machine.y + TrashcanMachine.height
  )
}

/** Frame copy with optimistically removed belts and machines filtered out. */
function frameWithoutPendingRemovals(frame: PipelineFrame, pending: PendingRemovals): PipelineFrame {
  if (
    pending.belts.size === 0 &&
    pending.combinerIds.size === 0 &&
    pending.splitterIds.size === 0 &&
    pending.tunnelPairIds.size === 0 &&
    pending.trashcanIds.size === 0
  ) {
    return frame
  }
  return {
    ...frame,
    belts: frame.belts.filter((belt) => !pending.belts.has(cellKey(belt))),
    combiners: (frame.combiners ?? []).filter((machine) => !pending.combinerIds.has(machine.id)),
    splitters: (frame.splitters ?? []).filter((machine) => !pending.splitterIds.has(machine.id)),
    tunnels: (frame.tunnels ?? []).filter((portal) => !pending.tunnelPairIds.has(portal.pairId)),
    trashcans: (frame.trashcans ?? []).filter((machine) => !pending.trashcanIds.has(machine.id)),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function chunkCoordUnderPointer(
  frame: PipelineFrame,
  rules: PipelineRules,
  camera: GridCamera,
  pointer: { x: number; y: number } | null,
): { cx: number; cy: number } | null {
  if (!pointer) return null
  const cell = camera.cellAt(pointer.x, pointer.y, cellSize)
  if (cell.x < 0 || cell.y < 0 || cell.x >= frame.width || cell.y >= frame.height) return null
  const origin = frame.originChunk ?? { cx: 0, cy: 0 }
  const chunkSize = rules.chunkSize
  return {
    cx: origin.cx + Math.floor(cell.x / chunkSize),
    cy: origin.cy + Math.floor(cell.y / chunkSize),
  }
}

function previewChunkUnderPointer(
  frame: PipelineFrame,
  rules: PipelineRules,
  camera: GridCamera,
  pointer: { x: number; y: number } | null,
): { cx: number; cy: number } | null {
  const coord = chunkCoordUnderPointer(frame, rules, camera, pointer)
  if (!coord) return null
  const key = `${coord.cx},${coord.cy}`
  if (!(frame.previewChunks ?? []).some((item) => `${item.cx},${item.cy}` === key)) return null
  return coord
}

function optionalCoreChunkUnderPointer(
  frame: PipelineFrame,
  rules: PipelineRules,
  camera: GridCamera,
  pointer: { x: number; y: number } | null,
): { cx: number; cy: number } | null {
  const coord = chunkCoordUnderPointer(frame, rules, camera, pointer)
  if (!coord) return null
  const key = `${coord.cx},${coord.cy}`
  if (!(frame.optionalCoreChunkKeys ?? []).includes(key)) return null
  if (!(frame.ownedChunks ?? []).some((item) => `${item.cx},${item.cy}` === key)) return null
  return coord
}

function previewBuyAnchor(
  frame: PipelineFrame,
  rules: PipelineRules,
  camera: GridCamera,
  view: ViewSize,
  coord: { cx: number; cy: number },
): ChunkBuyAnchor[] {
  const origin = frame.originChunk ?? { cx: 0, cy: 0 }
  const chunkSize = rules.chunkSize
  const pad = 36
  const localX = (coord.cx - origin.cx) * chunkSize
  const localY = (coord.cy - origin.cy) * chunkSize
  const left = camera.x + localX * cellSize * camera.zoom
  const top = camera.y + localY * cellSize * camera.zoom
  const extent = chunkSize * cellSize * camera.zoom
  if (left >= view.width || top >= view.height || left + extent <= 0 || top + extent <= 0) return []
  const centerX = left + extent / 2
  const centerY = top + extent / 2
  return [
    {
      key: `${coord.cx},${coord.cy}`,
      cx: coord.cx,
      cy: coord.cy,
      x: Math.round(clamp(centerX, pad, Math.max(pad, view.width - pad))),
      y: Math.round(clamp(centerY, pad, Math.max(pad, view.height - pad))),
    },
  ]
}
