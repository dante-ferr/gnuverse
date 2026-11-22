import type { Direction } from './model/frame'

const FACINGS: Direction[] = ['east', 'south', 'west', 'north']

let direction: Direction = 'east'

export function getBeltPlaceDirection(): Direction {
  return direction
}

export function setBeltPlaceDirection(next: Direction) {
  direction = next
}

export function cycleBeltPlaceDirection(step = 1) {
  const index = FACINGS.indexOf(direction)
  direction = FACINGS[(index + step + FACINGS.length) % FACINGS.length]!
  return direction
}
