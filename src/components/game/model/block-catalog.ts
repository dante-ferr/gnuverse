import type { BlockKind } from './types'

export type BlockShape = { width: number; height: number; label: string }

export const BLOCKS: Record<BlockKind, BlockShape> = {
  square: { width: 60, height: 60, label: 'Cubo' },
  wide: { width: 110, height: 36, label: 'Viga' },
  tall: { width: 36, height: 100, label: 'Coluna' },
}

/** Builder presets. A column is a beam stood at 90°, not a separate shape. */
export const PIECES = [
  { id: 'square', kind: 'square', label: 'Cubo' },
  { id: 'wide', kind: 'wide', label: 'Viga' },
  { id: 'column', kind: 'wide', label: 'Coluna', angle: 90 },
] as const

export type PieceId = (typeof PIECES)[number]['id']

export function selectedPiece(kind: BlockKind, angle: number): PieceId {
  if (kind === 'wide' && Math.abs(angle) === 90) return 'column'
  if (kind === 'wide') return 'wide'
  return 'square'
}

/** Applies a piece preset. Column sets the beam to 90°. Choosing the beam again lays that column flat. */
export function applyPiece(
  pieceId: PieceId,
  current: { kind: BlockKind; angle: number },
): { kind: BlockKind; angle: number } {
  const piece = PIECES.find((item) => item.id === pieceId)
  if (!piece) return current
  if ('angle' in piece) return { kind: piece.kind, angle: piece.angle }
  if (piece.kind === 'wide' && Math.abs(current.angle) === 90) {
    return { kind: piece.kind, angle: 0 }
  }
  return { kind: piece.kind, angle: current.angle }
}

export const COLORS = ['#8b5cf6', '#f0ad65', '#70b5a2', '#e6889b', '#8ca9d8']
