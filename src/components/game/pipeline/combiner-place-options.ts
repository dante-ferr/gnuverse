import type { CombinerMachineId } from '../../../../game-server/pipeline/machines/combiner-machine.ts'
import type { Direction } from './model/frame'

export type CombinerPlaceOptions = {
  /** Null until the player picks a recipe in the place flow. */
  recipeId: string | null
  facing: Direction
}

const FACINGS: Direction[] = ['east', 'south', 'west', 'north']
const listeners = new Set<() => void>()

let options: CombinerPlaceOptions = { recipeId: null, facing: 'east' }

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

/** Drop the recipe when it does not belong to the selected machine kind. */
export function clearCombinerRecipeIfInvalid(
  machineId: CombinerMachineId,
  recipeIds: readonly string[],
) {
  if (options.recipeId == null) return
  if (recipeIds.includes(options.recipeId)) return
  options = { ...options, recipeId: null }
  notify()
}
