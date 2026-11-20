import { getCombinerPlaceOptions } from './combiner-place-options.ts'
import type { Direction, PipelineFrame } from './model/frame.ts'

export function beltDirectionAt(
  frame: PipelineFrame | null | undefined,
  cell: { x: number; y: number },
): Direction | null {
  const belt = frame?.belts.find((item) => item.x === cell.x && item.y === cell.y)
  return belt?.direction ?? null
}

/** Facing for splitter/tunnel preview and commit when replacing a belt. */
export function resolveLogisticFacing(
  cell: { x: number; y: number },
  frame: PipelineFrame | null | undefined,
): Direction {
  return beltDirectionAt(frame, cell) ?? getCombinerPlaceOptions().facing
}

export function resolveTunnelFacing(
  entrance: { x: number; y: number },
  exit: { x: number; y: number } | null,
  frame: PipelineFrame | null | undefined,
): Direction {
  return (
    beltDirectionAt(frame, entrance) ??
    (exit ? beltDirectionAt(frame, exit) : null) ??
    getCombinerPlaceOptions().facing
  )
}