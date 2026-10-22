'use client'

import { useRef, type PointerEvent } from 'react'
import { BLOCKS } from '../model/block-catalog'
import type { BlockKind, Frame, Snapshot, Tower } from '../model/types'
import styles from '../tower-game.module.css'
import { Blocks } from './block-shapes'

export type TowerSceneProps = {
  frame: Frame
  preview: Snapshot | null
  tower: Tower | null
  kind: BlockKind
  color: string
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
  color,
  x,
  y,
  angle,
  maxBlocks,
  onPositionChange,
  onPreviewClose,
}: TowerSceneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const shape = BLOCKS[kind]

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (preview || !svgRef.current) return
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
          {preview
            ? 'Consultando uma versão anterior'
            : tower?.name || 'O próximo bloco pode ser seu.'}
        </span>
        <span>
          {preview
            ? `${preview.blocks.length} blocos nesta versão`
            : `${frame.blocks.length} / ${maxBlocks} blocos`}
        </span>
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
            <circle cx="1" cy="1" r="1" fill="#c9c3d2" />
          </pattern>
        </defs>
        <rect width="1000" height="800" fill="#f1efe8" />
        <rect width="1000" height="740" fill="url(#game-grid)" />
        <text x="40" y="55" fill="#89828e" fontSize="14" letterSpacing="3">
          ESPAÇO COMUM / GNUVERSE
        </text>
        <line
          x1="500"
          y1="95"
          x2="500"
          y2="740"
          stroke="#d0c7dd"
          strokeDasharray="5 9"
        />
        <rect y="740" width="1000" height="60" fill="#e0dccf" />
        <line
          x1="0"
          y1="740"
          x2="1000"
          y2="740"
          stroke="#655d6a"
          strokeWidth="3"
        />
        <Blocks blocks={preview?.blocks || frame.blocks} />
        {!preview && tower && (
          <g opacity=".55" transform={`translate(${x} ${y}) rotate(${angle})`}>
            <rect
              x={-shape.width / 2}
              y={-shape.height / 2}
              width={shape.width}
              height={shape.height}
              rx="5"
              fill={color}
              stroke="#392e4c"
              strokeWidth="2"
              strokeDasharray="5 4"
            />
            <path
              d="M0 0v35m-6-6 6 6 6-6"
              fill="none"
              stroke="#392e4c"
              strokeWidth="2"
            />
          </g>
        )}
        {!tower && (
          <text
            x="500"
            y="360"
            textAnchor="middle"
            fill="#796d86"
            fontSize="21"
          >
            Crie uma torre para começar.
          </text>
        )}
        <text x="40" y="778" fontSize="15" fill="#716b65">
          CHÃO FIRME. IDEIAS LIVRES.
        </text>
      </svg>
      <div className={styles.stageFooter}>
        <span>
          {preview
            ? `Comparação: ${preview.blocks.length} blocos na versão; ${frame.blocks.length} na torre atual. ${frame.blocks.filter((block) => !preview.blocks.some((old) => old.id === block.id)).length} blocos atuais seriam removidos.`
            : frame.settled
              ? 'A construção está em repouso.'
              : 'A gravidade está trabalhando…'}
        </span>
        {preview ? (
          <button className={styles.quiet} onClick={onPreviewClose}>
            Voltar ao vivo ↗
          </button>
        ) : (
          <span>Toque no cenário para posicionar</span>
        )}
      </div>
    </section>
  )
}
