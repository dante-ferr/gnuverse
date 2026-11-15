'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { TreeFrame, TreeNode, Tower } from '../model/types'
import styles from '../tower-game.module.css'

const WORLD_WIDTH = 800
const WORLD_HEIGHT = 1200
const HIT_RADIUS = 24

export type TreeSceneProps = {
  frame: TreeFrame
  tower: Tower | null
  expanded: boolean
  growFrom: string | null
  growPreview: { x: number; y: number } | null
  onToggleExpanded: () => void
  onSelectNode: (node: TreeNode) => void
  onGrowPreview: (point: { x: number; y: number } | null) => void
  onGrowCommit: (point: { x: number; y: number }) => void
}

function toCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  point: { x: number; y: number },
) {
  const scale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT)
  const offsetX = (width - WORLD_WIDTH * scale) / 2
  const offsetY = (height - WORLD_HEIGHT * scale) / 2
  return {
    x: offsetX + point.x * scale,
    y: offsetY + point.y * scale,
    scale,
  }
}

export function TreeScene({
  frame,
  tower,
  expanded,
  growFrom,
  growPreview,
  onToggleExpanded,
  onSelectNode,
  onGrowPreview,
  onGrowCommit,
}: TreeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 360, height: 540 })
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
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0b0f14'
    ctx.fillRect(0, 0, size.width, size.height)
    const nodes = frame.nodes.filter((n) => !n.broken)
    const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const node of nodes) {
      if (!node.parentId) continue
      const parent = byId.get(node.parentId)
      if (!parent) continue
      const a = toCanvas(ctx, size.width, size.height, parent)
      const b = toCanvas(ctx, size.width, size.height, node)
      ctx.strokeStyle = node.fortified ? '#8fd4ff' : '#57c79e'
      ctx.lineWidth = Math.max(3, 5 * a.scale)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    const exit = frame.exit
    const ex = toCanvas(ctx, size.width, size.height, { x: exit.x, y: exit.y })
    ctx.strokeStyle = '#f5d76e'
    ctx.strokeRect(ex.x, ex.y, exit.width * ex.scale, exit.height * ex.scale)
    if (frame.fireflyPosition) {
      const fly = toCanvas(ctx, size.width, size.height, frame.fireflyPosition)
      const gradient = ctx.createRadialGradient(fly.x, fly.y, 0, fly.x, fly.y, 120 * fly.scale)
      gradient.addColorStop(0, 'rgba(255,240,120,0.35)')
      gradient.addColorStop(1, 'rgba(255,240,120,0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(fly.x, fly.y, 120 * fly.scale, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff6a8'
      ctx.beginPath()
      ctx.arc(fly.x, fly.y, 5 * fly.scale, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const node of nodes) {
      const p = toCanvas(ctx, size.width, size.height, node)
      ctx.fillStyle = node.leaf ? '#9ef7c3' : node.parentId === null ? '#c4a46b' : '#dfe6ee'
      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.max(HIT_RADIUS / 2, 8) * p.scale, 0, Math.PI * 2)
      ctx.fill()
    }
    if (growFrom && growPreview) {
      const parent = byId.get(growFrom)
      if (parent) {
        const a = toCanvas(ctx, size.width, size.height, parent)
        const b = toCanvas(ctx, size.width, size.height, growPreview)
        ctx.setLineDash([6, 6])
        ctx.strokeStyle = '#64d9ff'
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
    ctx.fillStyle = '#c8d2dc'
    ctx.font = '12px system-ui'
    ctx.fillText(`Energia: ${frame.energy}`, 12, 20)
    ctx.fillText(`Fase: ${frame.turn.phase}`, 12, 36)
    if (tower?.outcome && tower.outcome !== 'playing') {
      ctx.fillText(tower.outcome === 'won' ? 'Vitória' : 'Derrota', 12, 52)
    }
  }, [frame, growFrom, growPreview, size, tower?.outcome])
  const pointerToWorld = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scale = Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT)
    const offsetX = (rect.width - WORLD_WIDTH * scale) / 2
    const offsetY = (rect.height - WORLD_HEIGHT * scale) / 2
    return {
      x: (event.clientX - rect.left - offsetX) / scale,
      y: (event.clientY - rect.top - offsetY) / scale,
    }
  }
  const hitNode = (point: { x: number; y: number }) => {
    let best: TreeNode | null = null
    let bestDist = HIT_RADIUS
    for (const node of frame.nodes.filter((n) => !n.broken)) {
      const dist = Math.hypot(node.x - point.x, node.y - point.y)
      if (dist < bestDist) {
        best = node
        bestDist = dist
      }
    }
    return best
  }
  return (
    <section className={expanded ? `${styles.scene} ${styles.sceneExpanded}` : styles.scene}>
      <div className={styles.sceneHeader}>
        <h2>Árvore na caverna</h2>
        <button type="button" onClick={onToggleExpanded}>
          {expanded ? 'Recolher' : 'Expandir'}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className={styles.treeCanvas}
        style={{ touchAction: 'none', width: '100%', aspectRatio: `${WORLD_WIDTH} / ${WORLD_HEIGHT}` }}
        onPointerDown={(event) => {
          const world = pointerToWorld(event)
          if (!world) return
          const node = hitNode(world)
          if (growFrom) onGrowCommit(world)
          else if (node) onSelectNode(node)
        }}
        onPointerMove={(event) => {
          if (!growFrom) return
          onGrowPreview(pointerToWorld(event))
        }}
      />
    </section>
  )
}