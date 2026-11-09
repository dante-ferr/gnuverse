'use client'

import { BLOCKS } from '../model/block-catalog'
import type { Block, BlockKind, Shard } from '../model/types'

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

export function Shards({ shards }: { shards: Shard[] }) {
  return shards.map((shard) => (
    <g
      key={shard.id}
      transform={`translate(${shard.x} ${shard.y}) rotate(${(shard.angle * 180) / Math.PI})`}
    >
      <rect
        x={-shard.width / 2}
        y={-shard.height / 2}
        width={shard.width}
        height={shard.height}
        rx="2"
        ry="2"
        fill="var(--block-face)"
        stroke="var(--scene)"
        strokeWidth="2"
        opacity="0.92"
      />
    </g>
  ))
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
