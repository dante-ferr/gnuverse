import type { StructureDefinition } from './types.ts'

const structures = new Map<string, StructureDefinition>()
const order: string[] = []

/** Registers a placeable structure. Later registrations with the same id replace the entry. */
export function registerStructure(definition: StructureDefinition) {
  if (!structures.has(definition.id)) order.push(definition.id)
  structures.set(definition.id, definition)
}

export function listStructures(): StructureDefinition[] {
  return order.map((id) => structures.get(id)!).filter(Boolean)
}

export function getStructure(id: string): StructureDefinition | null {
  return structures.get(id) ?? null
}

export function defaultStructureId(): string {
  return order[0] ?? ''
}
