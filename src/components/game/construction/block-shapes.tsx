'use client'

import { BLOCKS } from '../model/block-catalog'
import type { Block } from '../model/types'

export function Blocks({ blocks }: { blocks: Block[] }) {
  return blocks.map((block) => {
    const shape = BLOCKS[block.kind]
    if (!shape) return null
    return (
      <g
        key={block.id}
        transform={`translate(${block.x} ${block.y}) rotate(${(block.angle * 180) / Math.PI})`}
      >
        <rect
          x={-shape.width / 2}
          y={-shape.height / 2}
          width={shape.width}
          height={shape.height}
          rx="5"
          fill={block.color}
          stroke="#302c3a"
          strokeWidth="1.5"
        />
        <path
          d={`M${-shape.width / 2 + 7} ${-shape.height / 2 + 7}h${shape.width - 14}`}
          stroke="white"
          strokeOpacity=".45"
          strokeWidth="3"
        />
      </g>
    )
  })
}
