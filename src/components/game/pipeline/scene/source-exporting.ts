import { SourceMachine } from '../../../../../game-server/pipeline/machines/source-machine.ts'
import type { SourceRecord } from '../model/frame.ts'
import type { PacketMotionState } from './packet-motion.ts'

/** Output slot cell (one step outside the 3×3 source along `direction`). */
export function sourceOutputCell(
  spec: Pick<SourceRecord, 'id' | 'x' | 'y' | 'direction' | 'shape'>,
): { x: number; y: number } {
  const source = new SourceMachine(spec.id, { x: spec.x, y: spec.y }, spec.direction, spec.shape, 1)
  const slot = source.slots.find((item) => item.role === 'output')
  if (!slot) throw new Error(`source ${spec.id} has no output slot`)
  return { ...slot.cell }
}

/**
 * True while a packet is actively leaving the source output cell.
 * Idle, blocked, or a settled packet on the output (no motion) is false.
 */
export function sourceIsExporting(
  outputCell: { x: number; y: number },
  motion: PacketMotionState,
): boolean {
  for (const [id, at] of motion.at) {
    const from = motion.from.get(id) ?? at
    const onOutput = at.x === outputCell.x && at.y === outputCell.y
    const fromWasOutput = from.x === outputCell.x && from.y === outputCell.y
    const moving = from.x !== at.x || from.y !== at.y
    if (onOutput && moving) return true
    if (fromWasOutput && !onOutput) return true
  }
  return false
}