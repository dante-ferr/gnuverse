'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { TreeRules } from '../../../../../game-server/config/load-game-config.ts'
import type { TreeFrame, Tower } from '../../model/types'
import styles from '../../tower-game.module.css'
import { GrowGesture, type GrowAnchor } from './grow-gesture'
import { ReachSegments } from './reach-segments'
import { ScenePainter } from './scene-painter'
import { ScenePointer } from './scene-pointer'
import { SceneView, ZOOM_STEP, type GameCamera } from './scene-view'

export type { GrowAnchor, GameCamera }

export type TreeSceneProps = {
  frame: TreeFrame
  tower: Tower | null
  treeRules: TreeRules
  growAnchor: GrowAnchor | null
  growPreview: { x: number; y: number } | null
  camera: GameCamera
  onCameraChange: (patch: Partial<GameCamera>) => void
  onSelectNode: (node: TreeFrame['nodes'][number]) => void
  onGrowAnchor: (anchor: GrowAnchor | null) => void
  onGrowPreview: (point: { x: number; y: number } | null) => void
  onGrowCommit: (point: { x: number; y: number }) => void
}

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
  const pointerRef = useRef(new ScenePointer())
  const keysRef = useRef(new Set<string>())
  const painterRef = useRef(new ScenePainter())
  const [size, setSize] = useState({ width: 800, height: 600 })
  const view = new SceneView(size.width, size.height, treeRules, camera)
  const terrain = ReachSegments.terrain(treeRules)
  const seed = frame.treeSeed ?? tower?.id ?? 'default'

  const updateCamera = useCallback(
    (patch: Partial<GameCamera>) => {
      const next = new SceneView(size.width, size.height, treeRules, {
        x: patch.x ?? camera.x,
        y: patch.y ?? camera.y,
        zoom: patch.zoom ?? camera.zoom,
      })
      onCameraChange(next.clamp(next.camera.x, next.camera.y, next.camera.zoom))
    },
    [camera.x, camera.y, camera.zoom, onCameraChange, size.height, size.width, treeRules],
  )

  const pointerToWorld = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const sx = ((event.clientX - rect.left) * size.width) / Math.max(rect.width, 1)
    const sy = ((event.clientY - rect.top) * size.height) / Math.max(rect.height, 1)
    return view.screenToWorld(sx, sy)
  }

  useEffect(() => {
    const next = new SceneView(size.width, size.height, treeRules, camera)
    const clamped = next.clamp(camera.x, camera.y, camera.zoom)
    if (clamped.x !== camera.x || clamped.y !== camera.y || clamped.zoom !== camera.zoom) {
      onCameraChange(clamped)
    }
  }, [camera, onCameraChange, size.height, size.width, treeRules])

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
    const id = window.setInterval(() => {
      let dx = 0
      let dy = 0
      const speed = treeRules.cameraPanSpeed
      if (keysRef.current.has('w') || keysRef.current.has('arrowup')) dy -= speed
      if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) dy += speed
      if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) dx -= speed
      if (keysRef.current.has('d') || keysRef.current.has('arrowright')) dx += speed
      if (dx || dy) updateCamera({ x: camera.x + dx, y: camera.y + dy })
    }, 1000 / 60)
    return () => clearInterval(id)
  }, [camera.x, camera.y, updateCamera, treeRules.cameraPanSpeed])

  useEffect(() => {
    if (!growAnchor) return
    const segment = ReachSegments.collect(frame.nodes, seed, terrain).find(
      (item) => item.id === growAnchor.segmentId,
    )
    if (!segment) return
    const point = ReachSegments.pointAt(segment, growAnchor.t)
    if (Math.hypot(point.x - growAnchor.x, point.y - growAnchor.y) < 0.2) return
    onGrowAnchor({ ...growAnchor, x: point.x, y: point.y })
  }, [frame, growAnchor, onGrowAnchor, seed, terrain])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, button, [contenteditable]')) return
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysRef.current[event.type === 'keydown' ? 'add' : 'delete'](key)
        event.preventDefault()
      }
      if (event.type === 'keydown' && key === 'escape' && growAnchor) {
        onGrowAnchor(null)
        onGrowPreview(null)
        event.preventDefault()
        return
      }
      if (event.type === 'keydown' && (key === '+' || key === '=' || key === '-')) {
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const factor = key === '-' ? 1 / ZOOM_STEP : ZOOM_STEP
        const next = new SceneView(size.width, size.height, treeRules, camera)
        onCameraChange(
          next.zoomed(rect.width / 2, rect.height / 2, next.clampZoom(camera.zoom * factor)),
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
  }, [camera, growAnchor, onCameraChange, onGrowAnchor, onGrowPreview, size.height, size.width, treeRules])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      const next = new SceneView(size.width, size.height, treeRules, camera)
      onCameraChange(
        next.zoomed(
          event.clientX - rect.left,
          event.clientY - rect.top,
          next.clampZoom(camera.zoom * factor),
        ),
      )
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [camera, onCameraChange, size.height, size.width, treeRules])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    painterRef.current.paint(ctx, view, frame, treeRules, seed, terrain, growAnchor, growPreview)
  }, [frame, growAnchor, growPreview, seed, size, terrain, treeRules, view])

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
          pointerRef.current.down(event.pointerId, event.clientX, event.clientY, event.button, camera.zoom)
        }}
        onPointerMove={(event) => {
          const canvas = canvasRef.current
          if (!canvas) return
          const rect = canvas.getBoundingClientRect()
          const action = pointerRef.current.move(
            event.pointerId,
            event.clientX,
            event.clientY,
            rect,
            treeRules.clickDragThresholdPx,
            view.scale(),
            (zoom) => view.clampZoom(zoom),
            Boolean(growAnchor),
          )
          if (action.type === 'pinch') {
            onCameraChange(view.zoomed(action.sx, action.sy, action.zoom))
            return
          }
          if (action.type === 'pan') {
            if (pointerRef.current.panning) canvas.setPointerCapture(event.pointerId)
            updateCamera({ x: camera.x - action.dx, y: camera.y - action.dy })
            return
          }
          if (action.type === 'preview') onGrowPreview(pointerToWorld(event))
        }}
        onPointerUp={(event) => {
          const result = pointerRef.current.up(event.pointerId)
          if (result === 'pan') {
            canvasRef.current?.releasePointerCapture(event.pointerId)
            return
          }
          if (result !== 'click') return
          const world = pointerToWorld(event)
          if (!world) return
          if (growAnchor) {
            onGrowCommit(world)
            return
          }
          const gesture = new GrowGesture(frame, treeRules, seed, terrain)
          const picked = gesture.pick(world)
          if (picked) {
            onGrowAnchor(picked.anchor)
            onGrowPreview(world)
            if (picked.node) onSelectNode(picked.node)
            return
          }
          const node = gesture.nodeAt(world)
          if (node) onSelectNode(node)
        }}
        onPointerCancel={(event) => pointerRef.current.cancel(event.pointerId)}
      />
    </section>
  )
}
