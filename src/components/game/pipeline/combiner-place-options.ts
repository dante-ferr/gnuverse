import type { Direction } from './model/frame'

export type CombinerPlaceOptions = {
  facing: Direction
}

const FACINGS: Direction[] = ['east', 'south', 'west', 'north']
const listeners = new Set<() => void>()

let options: CombinerPlaceOptions = { facing: 'east' }

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