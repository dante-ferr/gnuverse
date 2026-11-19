import { CombinerMachine, type CombinerMachineId } from '../../machines/combiner-machine.ts'
import type { Direction } from '../../geometry/direction.ts'
import { recipeForId } from '../tick/craft.ts'
import type { Match } from '../match.ts'

type Author = { id: string; nickname: string }

export type MachinePlaceRequest = {
  machineId: CombinerMachineId
  recipeId: string
  x: number
  y: number
  facing: Direction
}

/** Places and removes player combiners in sandbox matches. */
export class MachineEditor {
  private match: Match

  constructor(match: Match) {
    this.match = match
  }

  place(spec: MachinePlaceRequest, author: Author) {
    if (!this.match.sandbox) return 'Combinadores só estão disponíveis na sala teste.'
    const recipe = recipeForId(this.match.rules, spec.recipeId)
    if (!recipe || recipe.inputs.length === 0 || recipe.coproduct_of) {
      return 'Escolha uma receita válida antes de colocar a máquina.'
    }
    if (recipe.machine !== spec.machineId) {
      return 'Essa receita não usa essa máquina.'
    }
    const { width, height } = CombinerMachine.sizeFor(spec.machineId, spec.facing)
    if (!this.footprintInOwned(spec.x, spec.y, width, height)) {
      return 'Fora da área liberada.'
    }
    if (this.overlapsMachines(spec.x, spec.y, width, height)) {
      return 'Espaço ocupado por outra estrutura.'
    }
    if (this.overlapsBelts(spec.x, spec.y, width, height)) {
      return 'Há esteiras nesse espaço.'
    }
    const id = `c${this.match.nextCombinerSeq++}`
    this.match.combiners.push(
      new CombinerMachine(id, spec.machineId, recipe.id, { x: spec.x, y: spec.y }, spec.facing),
    )
    this.match.noteCollaborator(author)
    return null
  }

  /** Removes a combiner under `cell`. Returns false if none. */
  removeAt(cell: { x: number; y: number }, author: Author) {
    const index = this.match.combiners.findIndex((machine) => machine.covers(cell))
    if (index < 0) return false
    const [removed] = this.match.combiners.splice(index, 1)
    if (removed) {
      this.match.packets = this.match.packets.filter((packet) => !removed.covers(packet.cell))
    }
    this.match.noteCollaborator(author)
    return true
  }

  private footprintInOwned(x: number, y: number, width: number, height: number) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        if (!this.match.inPlayableBounds({ x: x + dx, y: y + dy })) return false
      }
    }
    return true
  }

  private overlapsMachines(x: number, y: number, width: number, height: number) {
    const covers = (ox: number, oy: number, w: number, h: number) =>
      x < ox + w && x + width > ox && y < oy + h && y + height > oy
    if (this.match.cores.some((core) => covers(core.origin.x, core.origin.y, core.width, core.height))) {
      return true
    }
    if (this.match.sources.some((source) => covers(source.origin.x, source.origin.y, source.width, source.height))) {
      return true
    }
    return this.match.combiners.some((machine) =>
      covers(machine.origin.x, machine.origin.y, machine.width, machine.height),
    )
  }

  private overlapsBelts(x: number, y: number, width: number, height: number) {
    return this.match.belts.some(
      (belt) =>
        belt.origin.x >= x &&
        belt.origin.x < x + width &&
        belt.origin.y >= y &&
        belt.origin.y < y + height,
    )
  }
}