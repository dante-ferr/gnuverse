import { cellKey } from '../../geometry/cell.ts'
import type { ElementRecord } from '../../elements/index.ts'
import { craftTicksForRecipe } from '../../elements/rate.ts'
import { CombinerMachine } from '../../machines/combiner-machine.ts'
import { Packet } from '../../packets/packet.ts'
import type { PipelineRules } from '../../rules.ts'
import type { Match } from '../match.ts'

/** Runs combiner buffers, craft countdown, and output eject. */
export class Craft {
  private match: Match

  constructor(match: Match) {
    this.match = match
  }

  resolve() {
    for (const combiner of this.match.combiners) this.tickCombiner(combiner)
  }

  private tickCombiner(combiner: CombinerMachine) {
    const recipe = recipeForId(this.match.rules, combiner.recipeId)
    if (!recipe) return

    if (combiner.pendingOutputs?.length) {
      const kept = this.tryEject(combiner, recipe)
      if (kept) return
    }

    if (combiner.craftRemaining !== null && combiner.craftRemaining > 0) {
      combiner.craftRemaining -= 1
      if (combiner.craftRemaining === 0) {
        combiner.pendingOutputs = outputShapes(recipe)
      }
      return
    }

    if (combiner.craftRemaining === 0) {
      combiner.pendingOutputs = outputShapes(recipe)
      this.tryEject(combiner, recipe)
      return
    }

    if (bufferHasInputs(combiner, recipe)) {
      for (const input of recipe.inputs) combiner.buffer[input] = (combiner.buffer[input] ?? 0) - 1
      const ticks = craftTicksForRecipe(this.match.rules.elements, this.match.rules.tickMs, recipe)
      if (ticks <= 1) {
        combiner.craftRemaining = 0
        combiner.pendingOutputs = outputShapes(recipe)
        this.tryEject(combiner, recipe)
      } else {
        combiner.craftRemaining = ticks - 1
      }
    }
  }

  private tryEject(combiner: CombinerMachine, recipe: ElementRecord): boolean {
    const pending = combiner.pendingOutputs
    if (!pending?.length) return false

    const outputs = combiner.orderedOutputSlots()
    const coupled = pending.length > 1

    if (coupled) {
      const shapes = pending
      if (outputs.length < shapes.length) return true
      const placements: { slot: (typeof outputs)[0]; shape: string }[] = []
      for (let i = 0; i < shapes.length; i++) {
        placements.push({ slot: outputs[i]!, shape: shapes[i]! })
      }
      if (!this.canPlaceAll(placements)) return true
      for (const plan of placements) this.placePacket(plan.slot, plan.shape)
      combiner.pendingOutputs = null
      combiner.craftRemaining = null
      return false
    }

    const shape = pending[0]!
    const machineKind = this.match.rules.elements.machines.find((m) => m.id === combiner.machineId)
    const readyPorts = outputs.filter((slot) => this.canPlace(slot, shape))
    if (readyPorts.length === 0) return true

    if (machineKind?.split_single_across_ports && outputs.length >= 2) {
      if (readyPorts.length >= 2) {
        const port = combiner.nextSplitPort
        const slot = readyPorts[port] ?? readyPorts[0]!
        this.placePacket(slot, shape)
        combiner.nextSplitPort = port === 0 ? 1 : 0
      } else {
        this.placePacket(readyPorts[0]!, shape)
      }
    } else {
      this.placePacket(readyPorts[0]!, shape)
    }

    combiner.pendingOutputs = null
    combiner.craftRemaining = null
    return false
  }

  private canPlaceAll(placements: { slot: { cell: { x: number; y: number } }; shape: string }[]) {
    return placements.every((plan) => this.canPlace(plan.slot, plan.shape))
  }

  private canPlace(slot: { cell: { x: number; y: number } }, _shape: string) {
    const key = cellKey(slot.cell)
    if (!this.match.beltAt(slot.cell)) return false
    if (this.match.packets.some((packet) => cellKey(packet.cell) === key)) return false
    return true
  }

  private placePacket(slot: { cell: { x: number; y: number } }, shape: string) {
    this.match.packets.push(
      new Packet(`p${this.match.nextPacketId++}`, { ...slot.cell }, shape),
    )
  }
}

export function recipeForId(rules: PipelineRules, recipeId: string): ElementRecord | null {
  const elements = rules.elements.elements
  let record = elements.find((el) => el.id === recipeId)
  if (record?.coproduct_of) {
    record = elements.find((el) => el.id === record!.coproduct_of) ?? record
  }
  if (!record || !record.inputs?.length) {
    record = elements.find((el) => el.id === recipeId && el.inputs?.length)
    if (!record) {
      const primary = elements.find((el) => el.coproduct_of === recipeId)
      if (primary) record = primary
    }
  }
  if (!record?.inputs?.length) return null
  return record
}

function outputShapes(recipe: ElementRecord): string[] {
  if (recipe.outputs?.length) return [...recipe.outputs]
  return [recipe.id]
}

function bufferHasInputs(combiner: CombinerMachine, recipe: ElementRecord) {
  for (const input of recipe.inputs) {
    if ((combiner.buffer[input] ?? 0) < 1) return false
  }
  return true
}

export function combinerAcceptsShape(combiner: CombinerMachine, rules: PipelineRules, shape: string) {
  const recipe = recipeForId(rules, combiner.recipeId)
  if (!recipe) return false
  if (!recipe.inputs.includes(shape)) return false
  return (combiner.buffer[shape] ?? 0) < 1
}