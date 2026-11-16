'use client'

import { useEffect, useRef } from 'react'
import type { PipelineFrame, PipelineRules } from '../model/frame.ts'
import { BeltStroke } from './belt-stroke.ts'
import { GridCamera } from './grid-camera.ts'
import { BeltPainter } from './painters/belt-painter.ts'
import { cellSize, GridPainter } from './painters/grid-painter.ts'
import { MachinePainter } from './painters/machine-painter.ts'
import { ReadoutPainter } from './painters/readout-painter.ts'
import styles from '../../tower-game.module.css'

type Props = {
  frame: PipelineFrame | null
  rules: PipelineRules | null
  onPlace: (cells: BeltStroke['cells']) => void
  onRemove: (cell: { x: number; y: number }) => void
}

/** Full-viewport grid. Readouts are painted on the core, not in a sidebar. */
export function PipelineScene({ frame, rules, onPlace, onRemove }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef(new GridCamera(24, 24))
  const frameRef = useRef(frame)
  const rulesRef = useRef(rules)
  const images = useRef<{ core: HTMLImageElement | null; source: HTMLImageElement | null }>({
    core: null,
    source: null,
  })
  frameRef.current = frame
  rulesRef.current = rules

  useEffect(() => {
    const core = new Image()
    const source = new Image()
    core.src = '/pipeline/core.svg'
    source.src = '/pipeline/source.svg'
    const redraw = () => paint()
    core.onload = redraw
    source.onload = redraw
    images.current = { core, source }
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
    canvas.width = Math.max(1, Math.floor(view.width * ratio))
    canvas.height = Math.max(1, Math.floor(view.height * ratio))
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    const camera = cameraRef.current
    camera.fit(view.width, view.height, cellSize)
    ctx.clearRect(0, 0, view.width, view.height)
    ctx.save()
    ctx.translate(camera.x, camera.y)
    ctx.scale(camera.zoom, camera.zoom)
    new GridPainter().draw(ctx, current, palette)
    const preview = stroke.current?.cells.map((cell, index) => ({
      id: `preview-${index}`,
      x: cell.x,
      y: cell.y,
      direction: cell.direction,
      authorId: '',
      authorNickname: '',
      placedAt: index,
    }))
    new BeltPainter().draw(ctx, [...current.belts, ...(preview ?? [])], palette)
    new MachinePainter(images.current.core, images.current.source).draw(ctx, current, palette)
    const hover = hoverLabel(current, camera, lastPointer.current)
    new ReadoutPainter().draw(ctx, current, palette, hover)
    ctx.restore()
  }

  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  const stroke = useRef<BeltStroke | null>(null)
  const pan = useRef<{ x: number; y: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

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

  return (
    <canvas
      ref={canvasRef}
      className={styles.pipelineCanvas}
      onContextMenu={(event) => {
        event.preventDefault()
        const cell = localCell(event)
        if (cell) onRemove(cell)
      }}
      onDoubleClick={(event) => {
        const cell = localCell(event)
        if (cell) onRemove(cell)
      }}
      onPointerDown={(event) => {
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (event.button === 1 || event.shiftKey || pointers.current.size > 1) {
          pan.current = { x: event.clientX, y: event.clientY }
          stroke.current = null
          return
        }
        if (event.button !== 0) return
        const cell = localCell(event)
        if (!cell) return
        const next = new BeltStroke()
        next.push(cell)
        stroke.current = next
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
        if (cell && stroke.current) stroke.current.push(cell)
        paint()
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId)
        pinchDistance.current = null
        pan.current = null
        const done = stroke.current
        stroke.current = null
        if (done && done.cells.length > 0) onPlace(done.cells)
      }}
      onPointerLeave={() => {
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
) {
  if (!pointer) return null
  const cell = camera.cellAt(pointer.x, pointer.y, cellSize)
  const belt = frame.belts.find((item) => item.x === cell.x && item.y === cell.y)
  if (!belt) return null
  return { x: belt.x, y: belt.y, nickname: belt.authorNickname }
}
