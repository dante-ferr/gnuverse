'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { hitTestRoot, hitTestSegments } from '../../../../core/tree/segment-geometry.ts'
import { terrainPolyline, terrainSurfaceY } from '../../../../core/tree/terrain.ts'
import type { TreeRules } from '../../../../game-server/config/load-game-config.ts'
import type { TreeFrame, TreeNode, Tower } from '../model/types'
import styles from '../tower-game.module.css'

export type GrowAnchor = {
  segmentId: string
  x: number
  y: number
  t: number
}

export type GameCamera = { x: number; y: number; zoom: number }

const ZOOM_MIN = 0.5
const ZOOM_MAX = 4
const ZOOM_STEP = 1.12

export type TreeSceneProps = {
  frame: TreeFrame
  tower: Tower | null
  treeRules: TreeRules
  growAnchor: GrowAnchor | null
  growPreview: { x: number; y: number } | null
  camera: GameCamera
  onCameraChange: (patch: Partial<GameCamera>) => void
  onSelectNode: (node: TreeNode) => void
  onGrowAnchor: (anchor: GrowAnchor | null) => void
  onGrowPreview: (point: { x: number; y: number } | null) => void
  onGrowCommit: (point: { x: number; y: number }) => void
}

type DragState =
  | { kind: 'pending'; x: number; y: number; button: number }
  | { kind: 'pan'; lastX: number; lastY: number; button: number }
  | null

export function TreeScene({
  frame,
  tower,
  treeRules,
  growAnchor,
  growPreview,
  camera,
  onCameraChange,
  onSelectNode,
  onGrowAnchor,
  onGrowPreview,
  onGrowCommit,
}: TreeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragState>(null)
  const keysRef = useRef(new Set<string>())
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)
  const [size, setSize] = useState({ width: 800, height: 600 })

  const viewScale = useCallback(() => {
    const base = Math.min(
      size.width / treeRules.worldWidth,
      size.height / treeRules.worldHeight,
    )
    return base * camera.zoom
  }, [camera.zoom, size.height, size.width, treeRules.worldHeight, treeRules.worldWidth])

  const viewOrigin = useCallback(
    (scale: number) => ({
      ox: (size.width - treeRules.worldWidth * scale) / 2,
      oy: (size.height - treeRules.worldHeight * scale) / 2,
    }),
    [size.height, size.width, treeRules.worldHeight, treeRules.worldWidth],
  )

  const clampZoom = (zoom: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))

  const clampCamera = useCallback(
    (x: number, y: number, zoom: number): GameCamera => {
      const scale =
        Math.min(
          size.width / treeRules.worldWidth,
          size.height / treeRules.worldHeight,
        ) * zoom
      const ox = (size.width - treeRules.worldWidth * scale) / 2
      const oy = (size.height - treeRules.worldHeight * scale) / 2
      const viewW = size.width / scale
      const viewH = size.height / scale
      const edgeX = ox / scale
      let cx = x
      let cy = y
      if (viewW >= treeRules.worldWidth) {
        cx = treeRules.worldWidth / 2 - (size.width / 2 - ox) / scale
      } else {
        const minX = edgeX
        const maxX = treeRules.worldWidth - viewW + edgeX
        cx = Math.min(maxX, Math.max(minX, x))
      }
      if (viewH >= treeRules.worldHeight) {
        cy = treeRules.worldHeight / 2 - (size.height / 2 - oy) / scale
      } else {
        const minY = oy / scale
        const maxY = treeRules.worldHeight - viewH + oy / scale
        cy = Math.min(maxY, Math.max(minY, y))
      }
      return { x: cx, y: cy, zoom }
    },
    [size.height, size.width, treeRules.worldHeight, treeRules.worldWidth],
  )

  const updateCamera = useCallback(
    (patch: Partial<GameCamera>) => {
      const next = {
        x: patch.x ?? camera.x,
        y: patch.y ?? camera.y,
        zoom: patch.zoom ?? camera.zoom,
      }
      onCameraChange(clampCamera(next.x, next.y, next.zoom))
    },
    [camera.x, camera.y, camera.zoom, clampCamera, onCameraChange],
  )

  const terrainCfg = {
    worldWidth: treeRules.worldWidth,
    terrainSamples: treeRules.terrainSamples,
    terrainAmplitude: treeRules.terrainAmplitude,
    terrainMaxSlope: treeRules.terrainMaxSlope,
    terrainBaseY: treeRules.terrainBaseY,
  }

  const worldToScreen = useCallback(
    (wx: number, wy: number) => {
      const scale = viewScale()
      const { ox, oy } = viewOrigin(scale)
      return {
        x: ox + (wx - camera.x) * scale,
        y: oy + (wy - camera.y) * scale,
        scale,
        ox,
        oy,
      }
    },
    [camera.x, camera.y, viewOrigin, viewScale],
  )

  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      const scale = viewScale()
      const { ox, oy } = viewOrigin(scale)
      return {
        x: (sx - ox) / scale + camera.x,
        y: (sy - oy) / scale + camera.y,
      }
    },
    [camera.x, camera.y, viewOrigin, viewScale],
  )

  const zoomAtScreen = useCallback(
    (sx: number, sy: number, nextZoom: number) => {
      const world = screenToWorld(sx, sy)
      const scale =
        (Math.min(
          size.width / treeRules.worldWidth,
          size.height / treeRules.worldHeight,
        ) *
          nextZoom)
      const { ox, oy } = viewOrigin(scale)
      updateCamera({
        zoom: nextZoom,
        x: world.x - (sx - ox) / scale,
        y: world.y - (sy - oy) / scale,
      })
    },
    [
      updateCamera,
      screenToWorld,
      size.height,
      size.width,
      treeRules.worldHeight,
      treeRules.worldWidth,
      viewOrigin,
    ],
  )

  useEffect(() => {
    const clamped = clampCamera(camera.x, camera.y, camera.zoom)
    if (
      clamped.x !== camera.x ||
      clamped.y !== camera.y ||
      clamped.zoom !== camera.zoom
    ) {
      onCameraChange(clamped)
    }
  }, [
    camera.x,
    camera.y,
    camera.zoom,
    clampCamera,
    onCameraChange,
    size.height,
    size.width,
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const step = () => {
      let dx = 0
      let dy = 0
      const speed = treeRules.cameraPanSpeed
      if (keysRef.current.has('w') || keysRef.current.has('arrowup')) dy -= speed
      if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) dy += speed
      if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) dx -= speed
      if (keysRef.current.has('d') || keysRef.current.has('arrowright')) dx += speed
      if (dx || dy) updateCamera({ x: camera.x + dx, y: camera.y + dy })
    }
    const id = window.setInterval(step, 1000 / 60)
    return () => clearInterval(id)
  }, [camera.x, camera.y, updateCamera, treeRules.cameraPanSpeed])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, button, [contenteditable]')) return
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysRef.current[event.type === 'keydown' ? 'add' : 'delete'](key)
        event.preventDefault()
      }
      if (event.type === 'keydown' && (key === '+' || key === '=' || key === '-')) {
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const factor = key === '-' ? 1 / ZOOM_STEP : ZOOM_STEP
        zoomAtScreen(
          rect.width / 2,
          rect.height / 2,
          clampZoom(camera.zoom * factor),
        )
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [camera.zoom, zoomAtScreen])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const sx = event.clientX - rect.left
      const sy = event.clientY - rect.top
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      zoomAtScreen(sx, sy, clampZoom(camera.zoom * factor))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [camera.zoom, zoomAtScreen])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = treeRules.colorBackground
    ctx.fillRect(0, 0, size.width, size.height)

    const seed = frame.treeSeed ?? tower?.id ?? 'default'
    const terrain = terrainPolyline(seed, terrainCfg)
    ctx.fillStyle = treeRules.colorForeground
    ctx.beginPath()
    const first = worldToScreen(terrain[0]!.x, terrain[0]!.y)
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < terrain.length; i++) {
      const p = worldToScreen(terrain[i]!.x, terrain[i]!.y)
      ctx.lineTo(p.x, p.y)
    }
    const br = worldToScreen(treeRules.worldWidth, treeRules.worldHeight)
    const bl = worldToScreen(0, treeRules.worldHeight)
    ctx.lineTo(br.x, br.y)
    ctx.lineTo(bl.x, bl.y)
    ctx.closePath()
    ctx.fill()

    const nodes = frame.nodes.filter((n) => !n.broken)
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const root = nodes.find((n) => n.parentId === null)
    ctx.strokeStyle = treeRules.colorForeground
    ctx.lineCap = 'round'
    if (root) {
      const groundY = terrainSurfaceY(root.x, seed, terrainCfg)
      const foot = worldToScreen(root.x, groundY)
      const top = worldToScreen(root.x, root.y)
      ctx.lineWidth = Math.max(3, 5 * foot.scale)
      ctx.beginPath()
      ctx.moveTo(foot.x, foot.y)
      ctx.lineTo(top.x, top.y)
      ctx.stroke()
    }
    for (const node of nodes) {
      if (!node.parentId) continue
      const parent = byId.get(node.parentId)
      if (!parent) continue
      const start = node.attach ?? parent
      const a = worldToScreen(start.x, start.y)
      const b = worldToScreen(node.x, node.y)
      ctx.lineWidth = Math.max(3, 5 * a.scale)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }

    const exit = frame.exit
    const ex = worldToScreen(exit.x, exit.y)
    ctx.strokeStyle = treeRules.colorExitStroke
    ctx.lineWidth = 2
    ctx.strokeRect(ex.x, ex.y, exit.width * ex.scale, exit.height * ex.scale)

    if (frame.fireflyPosition) {
      const fly = worldToScreen(frame.fireflyPosition.x, frame.fireflyPosition.y)
      ctx.fillStyle = treeRules.colorFireflyGlow
      ctx.beginPath()
      ctx.arc(fly.x, fly.y, 5 * fly.scale, 0, Math.PI * 2)
      ctx.fill()
    }

    for (const node of nodes) {
      const p = worldToScreen(node.x, node.y)
      if (node.leaf) {
        ctx.fillStyle = treeRules.colorForeground
        ctx.beginPath()
        ctx.arc(p.x, p.y - 6 * p.scale, 8 * p.scale, 0, Math.PI * 2)
        ctx.fill()
      } else if (node.parentId !== null) {
        ctx.fillStyle = treeRules.colorForeground
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4 * p.scale, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    if (growAnchor && growPreview) {
      const a = worldToScreen(growAnchor.x, growAnchor.y)
      const b = worldToScreen(growPreview.x, growPreview.y)
      ctx.setLineDash([6, 6])
      ctx.strokeStyle = treeRules.colorForeground
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.setLineDash([])
    }

  }, [
    camera,
    frame,
    growAnchor,
    growPreview,
    size,
    terrainCfg,
    treeRules,
    worldToScreen,
  ])

  const pointerToWorld = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return screenToWorld(event.clientX - rect.left, event.clientY - rect.top)
  }

  const hitNode = (point: { x: number; y: number }) => {
    let best: TreeNode | null = null
    let bestDist = treeRules.nodeHitRadius
    for (const node of frame.nodes.filter((n) => !n.broken)) {
      const dist = Math.hypot(node.x - point.x, node.y - point.y)
      if (dist < bestDist) {
        best = node
        bestDist = dist
      }
    }
    return best
  }

  const tryGrowPick = (world: { x: number; y: number }) => {
    const nodes = frame.nodes.filter((n) => !n.broken)
    const segment =
      hitTestSegments(nodes, world.x, world.y, treeRules.segmentHitPadding) ??
      hitTestRoot(nodes, world.x, world.y, treeRules.nodeHitRadius)
    if (!segment) return false
    onGrowAnchor({
      segmentId: segment.segmentId,
      x: segment.x,
      y: segment.y,
      t: segment.t,
    })
    onGrowPreview(null)
    return true
  }

  return (
    <section
      className={styles.sceneViewport}
      aria-label="Cena da árvore"
      style={{ background: treeRules.colorBackground }}
    >
      <p className={styles.sceneHud}>
        <span>Energia {frame.energy}</span>
        <span>Fase {frame.turn.phase}</span>
        <span>Zoom {Math.round(camera.zoom * 100)}%</span>
        {tower?.outcome && tower.outcome !== 'playing' && (
          <span>{tower.outcome === 'won' ? 'Vitória' : 'Derrota'}</span>
        )}
      </p>
      <canvas
        ref={canvasRef}
        className={styles.treeCanvas}
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => {
          pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          if (pointersRef.current.size === 2) {
            const pts = [...pointersRef.current.values()]
            const distance = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y)
            pinchRef.current = { distance, zoom: camera.zoom }
            dragRef.current = null
            return
          }
          if (event.button === 0 || event.button === 1) {
            dragRef.current = {
              kind: 'pending',
              x: event.clientX,
              y: event.clientY,
              button: event.button,
            }
          }
        }}
        onPointerMove={(event) => {
          pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          if (pointersRef.current.size === 2 && pinchRef.current) {
            const canvas = canvasRef.current
            if (!canvas) return
            const rect = canvas.getBoundingClientRect()
            const pts = [...pointersRef.current.values()]
            const distance = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y)
            const midX = (pts[0]!.x + pts[1]!.x) / 2 - rect.left
            const midY = (pts[0]!.y + pts[1]!.y) / 2 - rect.top
            const nextZoom = clampZoom((pinchRef.current.zoom * distance) / pinchRef.current.distance)
            zoomAtScreen(midX, midY, nextZoom)
            return
          }
          const drag = dragRef.current
          if (drag?.kind === 'pending') {
            const dist = Math.hypot(event.clientX - drag.x, event.clientY - drag.y)
            if (
              dist > treeRules.clickDragThresholdPx &&
              (drag.button === 0 || drag.button === 1)
            ) {
              dragRef.current = {
                kind: 'pan',
                lastX: event.clientX,
                lastY: event.clientY,
                button: drag.button,
              }
              canvasRef.current?.setPointerCapture(event.pointerId)
            }
          }
          if (dragRef.current?.kind === 'pan') {
            const scale = viewScale()
            const pan = dragRef.current
            const dx = (event.clientX - pan.lastX) / scale
            const dy = (event.clientY - pan.lastY) / scale
            dragRef.current = { ...pan, lastX: event.clientX, lastY: event.clientY }
            updateCamera({ x: camera.x - dx, y: camera.y - dy })
            return
          }
          if (growAnchor) {
            onGrowPreview(pointerToWorld(event))
          }
        }}
        onPointerUp={(event) => {
          pointersRef.current.delete(event.pointerId)
          if (pointersRef.current.size < 2) pinchRef.current = null
          const drag = dragRef.current
          dragRef.current = null
          if (drag?.kind === 'pan') {
            canvasRef.current?.releasePointerCapture(event.pointerId)
            return
          }
          if (drag?.kind !== 'pending' || drag.button !== 0) return
          const world = pointerToWorld(event)
          if (!world) return
          if (growAnchor) {
            onGrowCommit(world)
            return
          }
          const node = hitNode(world)
          if (node) onSelectNode(node)
          else tryGrowPick(world)
        }}
        onPointerCancel={(event) => {
          pointersRef.current.delete(event.pointerId)
          if (pointersRef.current.size < 2) pinchRef.current = null
          dragRef.current = null
        }}
      />
    </section>
  )
}