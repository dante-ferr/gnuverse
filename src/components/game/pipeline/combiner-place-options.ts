import type { CombinerMachineId } from '../../../../game-server/pipeline/machines/combiner-machine.ts'
import type { Direction } from './model/frame'

export type CombinerPlaceOptions = {
  recipeId: string
  facing: Direction
}

const FACINGS: Direction[] = ['east', 'south', 'west', 'north']
const listeners = new Set<() => void>()

let options: CombinerPlaceOptions = { recipeId: 'steam', facing: 'east' }

function notify() {
  for (const listener of listeners) listener()
}

export function subscribeCombinerPlaceOptions(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getCombinerPlaceOptions(): CombinerPlaceOptions {
  return options
}

export function setCombinerPlaceOptions(next: Partial<CombinerPlaceOptions>) {
  options = { ...options, ...next }
  notify()
}

export function cycleCombinerFacing(step = 1) {
  const index = FACINGS.indexOf(options.facing)
  const next = FACINGS[(index + step + FACINGS.length) % FACINGS.length]!
  options = { ...options, facing: next }
  notify()
  return next
}

/** Keep recipe valid for the selected machine kind. */
export function syncCombinerRecipeForMachine(
  machineId: CombinerMachineId,
  recipeIds: string[],
) {
  if (recipeIds.length === 0) return
  if (!recipeIds.includes(options.recipeId)) {
    options = { ...options, recipeId: recipeIds[0]! }
    notify()
  }
}
