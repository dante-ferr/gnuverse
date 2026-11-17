'use client'

import { useEffect, useRef } from 'react'
import type { PipelineFrame, PipelineRules } from '../model/frame.ts'
import { BeltEraseStroke } from './belt-erase-stroke.ts'
import { BeltStroke } from './belt-stroke.ts'
import { GridCamera } from './grid-camera.ts'
import { BeltPainter } from './painters/belt-painter.ts'
import { cellSize, GridPainter } from './painters/grid-painter.ts'
import { loadMachineDecor, MachinePainter } from './painters/machine-painter.ts'
import { PacketPainter } from './painters/packet-painter.ts'
import { ReadoutPainter } from './painters/readout-painter.ts'
import { createPacketMotionState, syncPacketMotion } from './packet-motion.ts'
import styles from '../../game-shell.module.css'

type Props = {
  frame: PipelineFrame | null
  rules: PipelineRules | null
  onPlace: (cells: BeltStroke['cells']) => void
  onRemove: (cells: { x: number; y: number }[]) => void
}

/** Full-viewport grid. Core requirements sit in the room sidebar. */
export function PipelineScene({ frame, rules, onPlace, onRemove }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef(new GridCamera(24, 24))
  const frameRef = useRef(frame)
  const rulesRef = useRef(rules)
  const images = useRef(loadMachineDecor(() => {}))
  const machinePainter = useRef(new MachinePainter(images.current))
  const gridPainter = useRef(new GridPainter())
  const beltPainter = useRef(new BeltPainter())
  const packetPainter = useRef(new PacketPainter())
  const readoutPainter = useRef(new ReadoutPainter())
  const packetMotion = useRef(createPacketMotionState())
  frameRef.current = frame
  rulesRef.current = rules

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
    const preview = stroke.current?.cells.map((cell, index) => ({
      id: `preview-${index}`,
      x: cell.x,
      y: cell.y,
      direction: cell.direction,
      authorId: '',
      authorNickname: '',
      placedAt: index,
    }))
    const timeMs = performance.now()
    syncPacketMotion(packetMotion.current, current, timeMs)
    const belts = visibleBelts(current)
    beltPainter.current.draw(ctx, [...belts, ...(preview ?? [])], palette, timeMs)
    packetPainter.current.draw(ctx, current, belts, palette, packetMotion.current, timeMs)
    machinePainter.current.draw(ctx, current, palette, camera.zoom, timeMs)
    const hover = hoverLabel(current, camera, lastPointer.current, hiddenBelts.current)
    readoutPainter.current.draw(ctx, current, palette, hover)
    ctx.restore()
  }

  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  const stroke = useRef<BeltStroke | null>(null)
  const eraseStroke = useRef<BeltEraseStroke | null>(null)
  const hiddenBelts = useRef(new Set<string>())
  const pan = useRef<{ x: number; y: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

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

  const localCell = (event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current
    const current = frameRef.current
    if (!canvas || !current) return null
    const view = canvas.getBoundingClientRect()
    const cell = cameraRef.current.cellAt(event.clientX - view.left, event.clientY - view.top, cellSize)
    if (cell.x < 0 || cell.y < 0 || cell.x >= current.width || cell.y >= current.height) return null
    return cell
  }

  const trackEraseCell = (cell: { x: number; y: number }) => {
    if (!eraseStroke.current?.push(cell)) return
    tryEraseCell(cell)
  }

  return (
    <canvas
      ref={canvasRef}
      className={styles.pipelineCanvas}
      onContextMenu={(event) => {
        event.preventDefault()
      }}
      onDoubleClick={(event) => {
        const cell = localCell(event)
        if (cell) tryEraseCell(cell)
      }}
      onPointerDown={(event) => {
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (event.button === 1 || event.shiftKey || pointers.current.size > 1) {
          pan.current = { x: event.clientX, y: event.clientY }
          stroke.current = null
          eraseStroke.current = null
          return
        }
        const cell = localCell(event)
        if (event.button === 2) {
          if (!cell) return
          event.preventDefault()
          canvasRef.current?.setPointerCapture(event.pointerId)
          const next = new BeltEraseStroke()
          eraseStroke.current = next
          trackEraseCell(cell)
          stroke.current = null
          return
        }
        if (event.button !== 0) return
        if (!cell) return
        const next = new BeltStroke()
        next.push(cell)
        stroke.current = next
        eraseStroke.current = null
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
        if (cell && eraseStroke.current) trackEraseCell(cell)
        else if (cell && stroke.current) stroke.current.push(cell)
        paint()
      }}
      onPointerUp={(event) => {
        if (eraseStroke.current) canvasRef.current?.releasePointerCapture(event.pointerId)
        pointers.current.delete(event.pointerId)
        pinchDistance.current = null
        pan.current = null
        eraseStroke.current = null
        revertPendingRemovals()
        const done = stroke.current
        stroke.current = null
        if (done && done.cells.length > 0) onPlace(done.cells)
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
