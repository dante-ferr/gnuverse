import type { BlockKind } from './types'

export type BlockShape = { width: number; height: number; label: string }

export const BLOCKS: Record<BlockKind, BlockShape> = {
  square: { width: 60, height: 60, label: 'Cubo' },
  wide: { width: 110, height: 36, label: 'Viga' },
  tall: { width: 36, height: 100, label: 'Coluna' },
}

export const COLORS = ['#8b5cf6', '#f0ad65', '#70b5a2', '#e6889b', '#8ca9d8']
