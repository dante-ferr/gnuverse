'use client'

import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react'
import type { BlockKind, Frame, Snapshot, Tower } from '../model/types'
import styles from '../tower-game.module.css'
import { Blocks, BlockGlyph, Shards } from './block-shapes'
import { WindIndicator, WindStreaks } from './wind-indicator'

const WORLD_WIDTH = 1000
const WORLD_HEIGHT = 800
const MIN_VIEW_WIDTH = 280

type Camera = { x: number; y: number; width: number; height: number }

const FULL_VIEW: Camera = {
  x: 0,
  y: 0,
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
}

export type TowerSceneProps = {
  frame: Frame
  preview: Snapshot | null
  tower: Tower | null
  kind: BlockKind
  x: number
  y: number
  angle: number
  maxBlocks: number
  expanded: boolean
  onToggleExpanded: () => void
  onPositionChange: (x: number, y: number) => void
  onPreviewClose: () => void
}

function clampCamera(camera: Camera): Camera {
  const width = Math.min(WORLD_WIDTH, Math.max(MIN_VIEW_WIDTH, camera.width))
  const height = width * (WORLD_HEIGHT / WORLD_WIDTH)
  return {
    width,
    height,
    x: Math.min(Math.max(0, camera.x), WORLD_WIDTH - width),
    y: Math.min(Math.max(0, camera.y), WORLD_HEIGHT - height),
  }
}

function zoomCamera(camera: Camera, factor: number, anchorX: number, anchorY: number): Camera {
  const width = camera.width * factor
  const height = camera.height * factor
  const ratioX = (anchorX - camera.x) / camera.width
  const ratioY = (anchorY - camera.y) / camera.height
  return clampCamera({
    width,
    height,
    x: anchorX - ratioX * width,
    y: anchorY - ratioY * height,
  })
}

function clientToWorld(svg: SVGSVGElement, clientX: number, clientY: number) {
  const point = svg.createSVGPoint()
  point.x = clientX
  point.y = clientY
  const matrix = svg.getScreenCTM()
  if (!matrix) return null
  return point.matrixTransform(matrix.inverse())
}

export function TowerScene({
  frame,
  preview,
  tower,
  kind,
  x,
  y,
  angle,
  maxBlocks,
  expanded,
  onToggleExpanded,
  onPositionChange,
  onPreviewClose,
}: TowerSceneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const cameraRef = useRef<Camera>(FULL_VIEW)
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [camera, setCamera] = useState<Camera>(FULL_VIEW)
  cameraRef.current = camera

  function updateCamera(next: Camera) {
    const clamped = clampCamera(next)
    cameraRef.current = clamped
    setCamera(clamped)
  }

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const world = clientToWorld(svg, event.clientX, event.clientY)
      if (!world) return
      const factor = event.deltaY > 0 ? 1.12 : 1 / 1.12
      updateCamera(zoomCamera(cameraRef.current, factor, world.x, world.y))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || !svgRef.current) return
    svgRef.current.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, moved: false }
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    const svg = svgRef.current
    if (!drag || !svg) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < 5) return
    drag.moved = true
    const view = cameraRef.current
    const rect = svg.getBoundingClientRect()
    updateCamera({
      ...view,
      x: view.x - (dx / rect.width) * view.width,
      y: view.y - (dy / rect.height) * view.height,
    })
    drag.x = event.clientX
    drag.y = event.clientY
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.moved || preview || frame.wind || !svgRef.current) return
    const world = clientToWorld(svgRef.current, event.clientX, event.clientY)
    if (!world) return
    onPositionChange(
      Math.round(Math.max(70, Math.min(930, world.x))),
      Math.round(Math.max(70, Math.min(680, world.y))),
    )
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const view = cameraRef.current
    const step = view.width * 0.08
    if (event.key === 'ArrowLeft') updateCamera({ ...view, x: view.x - step })
    else if (event.key === 'ArrowRight') updateCamera({ ...view, x: view.x + step })
    else if (event.key === 'ArrowUp') updateCamera({ ...view, y: view.y - step })
    else if (event.key === 'ArrowDown') updateCamera({ ...view, y: view.y + step })
    else if (event.key === '+' || event.key === '=')
      updateCamera(zoomCamera(view, 1 / 1.12, view.x + view.width / 2, view.y + view.height / 2))
    else if (event.key === '-' || event.key === '_')
      updateCamera(zoomCamera(view, 1.12, view.x + view.width / 2, view.y + view.height / 2))
    else if (event.key === '0') updateCamera(FULL_VIEW)
    else return
    event.preventDefault()
  }

  const blocks = preview?.blocks || frame.blocks
  const viewBox = `${camera.x} ${camera.y} ${camera.width} ${camera.height}`

  return (
    <section className={styles.stagePanel} aria-label="Área de construção">
      <div className={styles.stageHeading}>
        <span>
          {preview ? 'Versão anterior' : tower?.name || 'Selecione uma torre'}
        </span>
        <span className={styles.stageStatus}>
          {preview
            ? `${preview.blocks.length} blocos nesta versão`
            : `${frame.blocks.length} / ${maxBlocks} blocos`}
          {!preview && <WindIndicator wind={frame.wind} />}
          {!preview && !frame.wind && tower?.nextWindAt != null && (
            <span className={styles.windNext}>
              Vento em{' '}
              {Math.max(0, tower.nextWindAt - (tower.placementCount || 0))} blocos
            </span>
          )}
          <button type="button" className={styles.quiet} onClick={onToggleExpanded}>
            {expanded ? 'Recolher' : 'Ampliar'}
          </button>
        </span>
      </div>
      <svg
        ref={svgRef}
        className={styles.stage}
        viewBox={viewBox}
        role="img"
        tabIndex={0}
        aria-label={`Torre com ${blocks.length} blocos. Arraste para navegar, use a roda para ampliar e clique para posicionar.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          dragRef.current = null
        }}
        onKeyDown={handleKeyDown}
      >
        <defs>
          <pattern
            id="game-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="var(--scene-line)" />
          </pattern>
        </defs>
        <rect width="1000" height="800" fill="var(--scene)" />
        <rect width="1000" height="740" fill="url(#game-grid)" />
        <line
          x1="500"
          y1="95"
          x2="500"
          y2="740"
          stroke="var(--scene-line)"
          strokeDasharray="5 9"
        />
        <rect y="740" width="1000" height="60" fill="var(--ground)" />
        <line
          x1="0"
          y1="740"
          x2="1000"
          y2="740"
          stroke="var(--ground-edge)"
          strokeWidth="3"
        />
        <Blocks blocks={blocks} />
        {!preview && <Shards shards={frame.shards ?? []} />}
        {!preview && frame.wind?.phase === 'active' && (
          <WindStreaks direction={frame.wind.direction} />
        )}
        {!preview && tower && !frame.wind && (
          <g opacity=".55" transform={`translate(${x} ${y}) rotate(${angle})`}>
            <BlockGlyph kind={kind} />
          </g>
        )}
        {!tower && (
          <text
            x="500"
            y="360"
            textAnchor="middle"
            fill="var(--muted)"
            fontSize="21"
          >
            Crie uma torre.
          </text>
        )}
      </svg>
      <div className={styles.stageFooter}>
        <span>
          {preview
            ? `Comparação: ${preview.blocks.length} blocos na versão; ${frame.blocks.length} na torre atual. ${frame.blocks.filter((block) => !preview.blocks.some((old) => old.id === block.id)).length} blocos atuais seriam removidos.`
            : frame.wind
              ? 'Lançamentos bloqueados'
              : frame.settled
                ? 'Pronta'
                : 'Estabilizando…'}
        </span>
        <span className={styles.sceneNav}>
          {preview ? (
            <button type="button" className={styles.quiet} onClick={onPreviewClose}>
              Ao vivo
            </button>
          ) : (
            <span>Arraste para navegar. Clique para posicionar.</span>
          )}
          <button
            type="button"
            onClick={() =>
              updateCamera(
                zoomCamera(camera, 1 / 1.12, camera.x + camera.width / 2, camera.y + camera.height / 2),
              )
            }
          >
            Aproximar
          </button>
          <button
            type="button"
            onClick={() =>
              updateCamera(
                zoomCamera(camera, 1.12, camera.x + camera.width / 2, camera.y + camera.height / 2),
              )
            }
          >
            Afastar
          </button>
          <button type="button" onClick={() => updateCamera(FULL_VIEW)}>
            Centralizar
          </button>
        </span>
      </div>
    </section>
  )
}
