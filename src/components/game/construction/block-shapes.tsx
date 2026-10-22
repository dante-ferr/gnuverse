'use client'

import { BLOCKS } from '../model/block-catalog'
import type { Block, BlockKind } from '../model/types'

export function BlockGlyph({ kind }: { kind: BlockKind }) {
  const { width, height } = BLOCKS[kind]
  return (
    <rect
      x={-width / 2}
      y={-height / 2}
      width={width}
      height={height}
      rx="8"
      ry="8"
      fill="var(--block-face)"
      stroke="var(--scene)"
      strokeWidth="4"
    />
  )
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return blocks.map((block) =>
    BLOCKS[block.kind] ? (
      <g
        key={block.id}
        transform={`translate(${block.x} ${block.y}) rotate(${(block.angle * 180) / Math.PI})`}
      >
        <BlockGlyph kind={block.kind} />
      </g>
    ) : null,
  )
}
