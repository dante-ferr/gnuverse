import type { Cell } from '../geometry/cell.ts'
import { sameCell } from '../geometry/cell.ts'
import { ahead, opposite, type Direction } from '../geometry/direction.ts'
import type { PipelineRules } from '../rules.ts'
import { Slot } from './slot.ts'

/** Per-role “[” bracket size as percent of one grid cell (see `[pipeline]` TOML). */
export type SlotBracketStyle = {
  inputDepthPercent: number
  outputDepthPercent: number
  thickPercent: number
  /** Chevron tip depth along travel, baked into the spine (percent of one cell). */
  flowMarkDepthPercent: number
}

export const defaultSlotBracketStyle: SlotBracketStyle = {
  inputDepthPercent: 22,
  outputDepthPercent: 34,
  thickPercent: 18,
  flowMarkDepthPercent: 12,
}

export function slotBracketStyleFromRules(rules: PipelineRules): SlotBracketStyle {
  return {
    inputDepthPercent: rules.slotInputDepthPercent,
    outputDepthPercent: rules.slotOutputDepthPercent,
    thickPercent: rules.slotBracketThickPercent,
    flowMarkDepthPercent: rules.slotFlowMarkDepthPercent,
  }
}

/** A structure with a footprint and named input or output slots. */
export abstract class Machine {
  readonly slots: Slot[] = []
  readonly id: string
  readonly origin: Cell
  readonly width: number
  readonly height: number

  constructor(id: string, origin: Cell, width: number, height: number) {
    if (!Number.isInteger(width) || width <= 0)
      throw new Error(`Machine width must be a positive integer, got ${width}`)
    if (!Number.isInteger(height) || height <= 0)
      throw new Error(`Machine height must be a positive integer, got ${height}`)
    this.id = id
    this.origin = origin
    this.width = width
    this.height = height
  }

  abstract readonly kind: string

  covers(cell: Cell) {
    return (
      cell.x >= this.origin.x &&
      cell.x < this.origin.x + this.width &&
      cell.y >= this.origin.y &&
      cell.y < this.origin.y + this.height
    )
  }

  inputSlots() {
    return this.slots.filter((slot) => slot.role === 'input')
  }

  outputSlots() {
    return this.slots.filter((slot) => slot.role === 'output')
  }

  slotAt(cell: Cell, role: Slot['role']) {
    return this.slots.find((slot) => slot.role === role && sameCell(slot.cell, cell))
  }

  /**
   * Closed “[”-shaped polygon in world pixels.
   * Opens outward (inputs: opposite travel; outputs: travel).
   * Output spines include a chevron tip along `slot.travel`; inputs are plain brackets.
   * Spans one cell; may protrude past the machine body.
   */
  slotBracket(
    slot: Slot,
    cellPx: number,
    style: SlotBracketStyle = defaultSlotBracketStyle,
  ): { x: number; y: number }[] {
    const depthPct = slot.role === 'input' ? style.inputDepthPercent : style.outputDepthPercent
    const depth = (depthPct / 100) * cellPx
    const thick = (style.thickPercent / 100) * cellPx
    const open: Direction = slot.role === 'input' ? opposite(slot.travel) : slot.travel
    const left = slot.cell.x * cellPx
    const top = slot.cell.y * cellPx
    const right = left + cellPx
    const bottom = top + cellPx
    // Inputs: back on the outer rim of the footprint cell.
    // Outputs: back on the shared edge with the machine (inner side of the exterior cell).
    const fromOutside = slot.role === 'output'

    if (slot.role === 'input') {
      if (open === 'east') {
        const back = right
        const tip = back + depth
        const spine = back + thick
        return [
          { x: back, y: top },
          { x: tip, y: top },
          { x: tip, y: top + thick },
          { x: spine, y: top + thick },
          { x: spine, y: bottom - thick },
          { x: tip, y: bottom - thick },
          { x: tip, y: bottom },
          { x: back, y: bottom },
        ]
      }
      if (open === 'west') {
        const back = left
        const tip = back - depth
        const spine = back - thick
        return [
          { x: back, y: top },
          { x: tip, y: top },
          { x: tip, y: top + thick },
          { x: spine, y: top + thick },
          { x: spine, y: bottom - thick },
          { x: tip, y: bottom - thick },
          { x: tip, y: bottom },
          { x: back, y: bottom },
        ]
      }
      if (open === 'north') {
        const back = top
        const tip = back - depth
        const spine = back - thick
        return [
          { x: left, y: back },
          { x: left, y: tip },
          { x: left + thick, y: tip },
          { x: left + thick, y: spine },
          { x: right - thick, y: spine },
          { x: right - thick, y: tip },
          { x: right, y: tip },
          { x: right, y: back },
        ]
      }
      const back = bottom
      const tip = back + depth
      const spine = back + thick
      return [
        { x: left, y: back },
        { x: left, y: tip },
        { x: left + thick, y: tip },
        { x: left + thick, y: spine },
        { x: right - thick, y: spine },
        { x: right - thick, y: tip },
        { x: right, y: tip },
        { x: right, y: back },
      ]
    }

    const flow = (style.flowMarkDepthPercent / 100) * cellPx
    const midX = left + cellPx / 2
    const midY = top + cellPx / 2
    const half = thick * 0.9

    if (open === 'east') {
      const back = fromOutside ? left : right
      const tip = back + depth
      const spine = back + thick
      const towardTip = Math.min(flow, Math.max(0, tip - spine - 1))
      const towardBack = Math.min(flow, Math.max(0, Math.abs(spine - back) - 1))
      const tipX =
        slot.travel === 'east' ? spine + towardTip : spine - towardBack
      return [
        { x: back, y: top },
        { x: tip, y: top },
        { x: tip, y: top + thick },
        { x: spine, y: top + thick },
        { x: spine, y: midY - half },
        { x: tipX, y: midY },
        { x: spine, y: midY + half },
        { x: spine, y: bottom - thick },
        { x: tip, y: bottom - thick },
        { x: tip, y: bottom },
        { x: back, y: bottom },
      ]
    }
    if (open === 'west') {
      const back = fromOutside ? right : left
      const tip = back - depth
      const spine = back - thick
      const towardTip = Math.min(flow, Math.max(0, spine - tip - 1))
      const towardBack = Math.min(flow, Math.max(0, Math.abs(back - spine) - 1))
      const tipX =
        slot.travel === 'west' ? spine - towardTip : spine + towardBack
      return [
        { x: back, y: top },
        { x: tip, y: top },
        { x: tip, y: top + thick },
        { x: spine, y: top + thick },
        { x: spine, y: midY - half },
        { x: tipX, y: midY },
        { x: spine, y: midY + half },
        { x: spine, y: bottom - thick },
        { x: tip, y: bottom - thick },
        { x: tip, y: bottom },
        { x: back, y: bottom },
      ]
    }
    if (open === 'north') {
      const back = fromOutside ? bottom : top
      const tip = back - depth
      const spine = back - thick
      const towardTip = Math.min(flow, Math.max(0, spine - tip - 1))
      const towardBack = Math.min(flow, Math.max(0, Math.abs(back - spine) - 1))
      const tipY =
        slot.travel === 'north' ? spine - towardTip : spine + towardBack
      return [
        { x: left, y: back },
        { x: left, y: tip },
        { x: left + thick, y: tip },
        { x: left + thick, y: spine },
        { x: midX - half, y: spine },
        { x: midX, y: tipY },
        { x: midX + half, y: spine },
        { x: right - thick, y: spine },
        { x: right - thick, y: tip },
        { x: right, y: tip },
        { x: right, y: back },
      ]
    }
    const back = fromOutside ? top : bottom
    const tip = back + depth
    const spine = back + thick
    const towardTip = Math.min(flow, Math.max(0, tip - spine - 1))
    const towardBack = Math.min(flow, Math.max(0, Math.abs(spine - back) - 1))
    const tipY = slot.travel === 'south' ? spine + towardTip : spine - towardBack
    return [
      { x: left, y: back },
      { x: left, y: tip },
      { x: left + thick, y: tip },
      { x: left + thick, y: spine },
      { x: midX - half, y: spine },
      { x: midX, y: tipY },
      { x: midX + half, y: spine },
      { x: right - thick, y: spine },
      { x: right - thick, y: tip },
      { x: right, y: tip },
      { x: right, y: back },
    ]
  }

  protected addSlot(slot: Slot) {
    if (slot.role === 'input') this.validateInputSlot(slot)
    else this.validateOutputSlot(slot)
    this.slots.push(slot)
  }

  private onRim(cell: Cell) {
    return (
      cell.x === this.origin.x ||
      cell.x === this.origin.x + this.width - 1 ||
      cell.y === this.origin.y ||
      cell.y === this.origin.y + this.height - 1
    )
  }

  private validateInputSlot(slot: Slot) {
    if (!this.covers(slot.cell))
      throw new Error(
        `Input slot ${slot.id} must sit on the machine footprint, got (${slot.cell.x}, ${slot.cell.y})`,
      )
    if (!this.onRim(slot.cell))
      throw new Error(
        `Input slot ${slot.id} must be on the outer rim of the footprint, got (${slot.cell.x}, ${slot.cell.y})`,
      )
    const outside = ahead(slot.cell.x, slot.cell.y, opposite(slot.travel))
    if (this.covers(outside))
      throw new Error(
        `Input slot ${slot.id} must open outward: cell (${outside.x}, ${outside.y}) opposite travel must be outside the footprint`,
      )
  }

  private validateOutputSlot(slot: Slot) {
    if (this.covers(slot.cell))
      throw new Error(
        `Output slot ${slot.id} must lie outside the footprint, got (${slot.cell.x}, ${slot.cell.y})`,
      )
    const rim = ahead(slot.cell.x, slot.cell.y, opposite(slot.travel))
    if (!this.covers(rim))
      throw new Error(
        `Output slot ${slot.id} must attach to the rim: cell (${rim.x}, ${rim.y}) opposite travel must be on the footprint`,
      )
    const aheadCell = ahead(rim.x, rim.y, slot.travel)
    if (!sameCell(aheadCell, slot.cell))
      throw new Error(
        `Output slot ${slot.id} must be exactly one cell outside along travel from the rim attachment (${rim.x}, ${rim.y})`,
      )
  }
}
