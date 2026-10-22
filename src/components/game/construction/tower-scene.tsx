'use client'

import { useRef, type PointerEvent } from 'react'
import type { BlockKind, Frame, Snapshot, Tower } from '../model/types'
import styles from '../tower-game.module.css'
import { Blocks, BlockGlyph } from './block-shapes'
import { WindIndicator, WindStreaks } from './wind-indicator'

export type TowerSceneProps = {
  frame: Frame
  preview: Snapshot | null
  tower: Tower | null
  kind: BlockKind
  x: number
  y: number
  angle: number
  maxBlocks: number
  onPositionChange: (x: number, y: number) => void
  onPreviewClose: () => void
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
  onPositionChange,
  onPreviewClose,
}: TowerSceneProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (preview || frame.wind || !svgRef.current) return
    const point = svgRef.current.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const matrix = svgRef.current.getScreenCTM()
    if (!matrix) return
    const world = point.matrixTransform(matrix.inverse())
    onPositionChange(
      Math.round(Math.max(70, Math.min(930, world.x))),
      Math.round(Math.max(70, Math.min(680, world.y))),
    )
  }

  return (
    <section className={styles.stagePanel} aria-label="Área de construção">
      <div className={styles.stageHeading}>
        <span>
          {preview ? 'Versão anterior' : tower?.name || 'Selecione uma torre'}
        </span>
        <span>
          {preview
            ? `${preview.blocks.length} blocos nesta versão`
            : `${frame.blocks.length} / ${maxBlocks} blocos`}
        </span>
        {!preview && <WindIndicator wind={frame.wind} />}
        {!preview && !frame.wind && tower?.nextWindAt != null && (
          <span className={styles.windNext}>
            Vento em{' '}
            {Math.max(0, tower.nextWindAt - (tower.placementCount || 0))} blocos
          </span>
        )}
      </div>
      <svg
        ref={svgRef}
        className={styles.stage}
        viewBox="0 0 1000 800"
        role="img"
        aria-label={`Torre com ${(preview?.blocks || frame.blocks).length} blocos. Use os controles ao lado para escolher posição e lançar.`}
        onPointerDown={handlePointerDown}
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
        <Blocks blocks={preview?.blocks || frame.blocks} />
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
        {preview ? (
          <button className={styles.quiet} onClick={onPreviewClose}>
            Ao vivo
          </button>
        ) : (
          <span>Clique ou toque para posicionar</span>
        )}
      </div>
    </section>
  )
}
