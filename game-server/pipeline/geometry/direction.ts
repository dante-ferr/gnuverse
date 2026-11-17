export type Direction = 'north' | 'east' | 'south' | 'west'

export const directions: readonly Direction[] = ['north', 'east', 'south', 'west']

export function isDirection(value: unknown): value is Direction {
  return directions.includes(value as Direction)
}

export function ahead(x: number, y: number, direction: Direction) {
  if (direction === 'north') return { x, y: y - 1 }
  if (direction === 'south') return { x, y: y + 1 }
  if (direction === 'east') return { x: x + 1, y }
  return { x: x - 1, y }
}

export function opposite(direction: Direction): Direction {
  if (direction === 'north') return 'south'
  if (direction === 'south') return 'north'
  if (direction === 'east') return 'west'
  return 'east'
}
