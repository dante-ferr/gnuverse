'use client'

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { PipelineFrame, PipelineRules } from '../model/frame.ts'
import { getStructure, type StructurePlacementSession, type StructurePlaceRequest } from '../structures'
import { BeltEraseStroke } from './belt-erase-stroke.ts'
import { GridCamera } from './grid-camera.ts'
import { BeltPainter } from './painters/belt-painter.ts'
import { cellSize, GridPainter } from './painters/grid-painter.ts'
import { loadMachineDecor, MachinePainter } from './painters/machine-painter.ts'
import { PacketPainter } from './painters/packet-painter.ts'
import { ReadoutPainter } from './painters/readout-painter.ts'
import { createPacketMotionState, syncPacketMotion } from './packet-motion.ts'
import styles from '../../game-shell.module.css'

export type EditMode = 'create' | 'delete'

type Props = {
  frame: PipelineFrame | null
  rules: PipelineRules | null
  editMode: EditMode
  structureId: string
  onPlace: (request: StructurePlaceRequest) => void
  onRemove: (cells: { x: number; y: number }[]) => void
  onToggleEditMode: () => void
}

const KEY_PAN_SPEED = 10
const PAN_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])

/** Full-viewport grid. Core requirements sit in the room sidebar. */
export function PipelineScene({
  frame,
  rules,
  editMode,
  structureId,
  onPlace,
  onRemove,
  onToggleEditMode,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef(new GridCamera(24, 24))
  const frameRef = useRef(frame)
  const rulesRef = useRef(rules)
  const editModeRef = useRef(editMode)
  const structureIdRef = useRef(structureId)
  const onToggleEditModeRef = useRef(onToggleEditMode)
  const images = useRef(loadMachineDecor(() => {}))
  const machinePainter = useRef(new MachinePainter(images.current))
  const gridPainter = useRef(new GridPainter())
  const beltPainter = useRef(new BeltPainter())
  const packetPainter = useRef(new PacketPainter())
  const readoutPainter = useRef(new ReadoutPainter())
  const packetMotion = useRef(createPacketMotionState())
  frameRef.current = frame
  rulesRef.current = rules
  editModeRef.current = editMode
  structureIdRef.current = structureId
  onToggleEditModeRef.current = onToggleEditMode

  useEffect(() => {
    images.current = loadMachineDecor(() => paint())
    machinePainter.current = new MachinePainter(images.current)
  }, [])

  useEffect(() => {
    let frameId = 0
    const loop = () => {
      paint()
      frameId = requestAnimationFrame(loop)
    }
    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [])

  const paint = () => {
    const canvas = canvasRef.current
    const current = frameRef.current
    const palette = rulesRef.current
    if (!canvas || !current || !palette) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const view = canvas.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    const nextWidth = Math.max(1, Math.floor(view.width * ratio))
    const nextHeight = Math.max(1, Math.floor(view.height * ratio))
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth
      canvas.height = nextHeight
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    const camera = cameraRef.current
    camera.fit(view.width, view.height, cellSize)
    ctx.clearRect(0, 0, view.width, view.height)
    ctx.save()
    ctx.translate(camera.x, camera.y)
    ctx.scale(camera.zoom, camera.zoom)
    gridPainter.current.draw(ctx, current, palette)
    const preview = placement.current?.previewBelts() ?? []
    const timeMs = performance.now()
    syncPacketMotion(packetMotion.current, current, palette, timeMs, cellSize)
    const belts = visibleBelts(current)
    const previewKeys = new Set(preview.map((belt) => cellKey(belt)))
    const underPreview = belts.filter((belt) => !previewKeys.has(cellKey(belt)))
    beltPainter.current.draw(ctx, [...underPreview, ...preview], palette, timeMs)
    packetPainter.current.draw(ctx, current, belts, palette, packetMotion.current, timeMs)
    machinePainter.current.draw(ctx, current, palette, camera.zoom, timeMs)
    const hover = pinnedBlame.current ?? hoverLabel(current, camera, lastPointer.current, hiddenBelts.current)
    readoutPainter.current.draw(ctx, current, palette, hover)
    ctx.restore()
  }

  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  const pinnedBlame = useRef<{ x: number; y: number; nickname: string } | null>(null)
  const longPress = useRef<{
    timer: ReturnType<typeof setTimeout> | null
    origin: { x: number; y: number } | null
    fired: boolean
  }>({ timer: null, origin: null, fired: false })
  const placement = useRef<StructurePlacementSession | null>(null)
  const eraseStroke = useRef<BeltEraseStroke | null>(null)
  const hiddenBelts = useRef(new Set<string>())
  const pan = useRef<{ x: number; y: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const heldKeys = useRef(new Set<string>())

  const visibleBelts = (current: PipelineFrame) =>
    current.belts.filter((belt) => !hiddenBelts.current.has(cellKey(belt)))

  const tryEraseCell = (cell: { x: number; y: number }) => {
    const current = frameRef.current
    if (!current) return
    const key = cellKey(cell)
    if (hiddenBelts.current.has(key)) return
    if (!current.belts.some((belt) => belt.x === cell.x && belt.y === cell.y)) return
    hiddenBelts.current.add(key)
    onRemove([cell])
    paint()
  }

  const syncHiddenBelts = () => {
    const current = frameRef.current
    if (!current) return
    for (const key of [...hiddenBelts.current]) {
      const cell = parseCellKey(key)
      if (!cell) continue
      if (!current.belts.some((belt) => belt.x === cell.x && belt.y === cell.y)) hiddenBelts.current.delete(key)
    }
  }

  const revertPendingRemovals = () => {
    const current = frameRef.current
    if (!current) return
    for (const key of [...hiddenBelts.current]) {
      const cell = parseCellKey(key)
      if (!cell) continue
      if (current.belts.some((belt) => belt.x === cell.x && belt.y === cell.y)) hiddenBelts.current.delete(key)
    }
    paint()
  }

  useEffect(() => {
    syncHiddenBelts()
    paint()
  }, [frame])

  useEffect(() => {
    paint()
  })

  useEffect(() => {
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
          paint()
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
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const localCell = (event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current
    const current = frameRef.current
    if (!canvas || !current) return null
    const view = canvas.getBoundingClientRect()
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
        !hiddenBelts.current.has(cellKey(belt)),
    )

  const scheduleLongPress = (belt: { x: number; y: number; authorNickname: string }, x: number, y: number) => {
    cancelLongPress()
    longPress.current.origin = { x, y }
    longPress.current.timer = setTimeout(() => {
      pinnedBlame.current = { x: belt.x, y: belt.y, nickname: belt.authorNickname }
      longPress.current.fired = true
      longPress.current.timer = null
      placement.current = null
      paint()
    }, 450)
  }

  const trackEraseCell = (cell: { x: number; y: number }) => {
    if (!eraseStroke.current?.push(cell)) return
    tryEraseCell(cell)
  }

  const beginPan = (event: { clientX: number; clientY: number }) => {
    pan.current = { x: event.clientX, y: event.clientY }
    placement.current = null
    eraseStroke.current = null
    cancelLongPress()
  }

  const beginErase = (event: ReactPointerEvent<HTMLCanvasElement>, cell: { x: number; y: number }) => {
    event.preventDefault()
    canvasRef.current?.setPointerCapture(event.pointerId)
    const next = new BeltEraseStroke()
    eraseStroke.current = next
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
      paint()
      return
    }
    if (current) {
      const belt = beltAt(current, cell)
      if (belt) scheduleLongPress(belt, event.clientX, event.clientY)
      else pinnedBlame.current = null
    }
    const session = structure.createSession()
    session.push(cell)
    placement.current = session
    eraseStroke.current = null
  }

  return (
    <>
      <p className={styles.sceneHud} aria-live="polite">
        <span>{editMode === 'create' ? 'Criar' : 'Apagar'}</span>
        <span>E alterna</span>
      </p>
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
          lastPointer.current = { x: event.clientX, y: event.clientY }
          const canvas = canvasRef.current
          if (!canvas) return
          const view = canvas.getBoundingClientRect()
          lastPointer.current = { x: event.clientX - view.left, y: event.clientY - view.top }
          if (pointers.current.size >= 2) {
            const points = [...pointers.current.values()]
            const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
            const previous = pinchDistance.current
            if (previous) cameraRef.current.zoomAt(view.width / 2, view.height / 2, distance / previous, cellSize)
            pinchDistance.current = distance
            paint()
            return
          }
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          if (pan.current) {
            cameraRef.current.pan(event.clientX - pan.current.x, event.clientY - pan.current.y)
            pan.current = { x: event.clientX, y: event.clientY }
            paint()
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
          paint()
        }}
        onPointerUp={(event) => {
          if (eraseStroke.current) canvasRef.current?.releasePointerCapture(event.pointerId)
          pointers.current.delete(event.pointerId)
          pinchDistance.current = null
          pan.current = null
          eraseStroke.current = null
          revertPendingRemovals()
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
          if (eraseStroke.current) {
            canvasRef.current?.releasePointerCapture(event.pointerId)
            eraseStroke.current = null
            revertPendingRemovals()
          }
          lastPointer.current = null
          paint()
        }}
        onWheel={(event) => {
          event.preventDefault()
          const canvas = canvasRef.current
          if (!canvas) return
          const view = canvas.getBoundingClientRect()
          const factor = event.deltaY < 0 ? 1.08 : 0.92
          cameraRef.current.zoomAt(event.clientX - view.left, event.clientY - view.top, factor, cellSize)
          paint()
        }}
      />
    </>
  )
}

const pinchDistance = { current: null as number | null }

function hoverLabel(
  frame: PipelineFrame,
  camera: GridCamera,
  pointer: { x: number; y: number } | null,
  hidden: Set<string>,
) {
  if (!pointer) return null
  const cell = camera.cellAt(pointer.x, pointer.y, cellSize)
  const belt = frame.belts.find(
    (item) => item.x === cell.x && item.y === cell.y && !hidden.has(cellKey(item)),
  )
  if (!belt) return null
  return { x: belt.x, y: belt.y, nickname: belt.authorNickname }
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
