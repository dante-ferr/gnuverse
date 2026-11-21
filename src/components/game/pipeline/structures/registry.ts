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

/** Palette order, optionally including sandbox-only entries. */
export function listPlaceableStructures(sandbox = false): StructureDefinition[] {
  return listStructures().filter((item) => !item.sandboxOnly || sandbox)
}

/**
 * Digit key → structure in palette order.
 * `1`–`9` map to indices 0–8; `0` maps to index 9.
 */
export function structureForHotkey(
  key: string,
  options?: { sandbox?: boolean },
): StructureDefinition | null {
  if (!/^[0-9]$/.test(key)) return null
  const index = key === '0' ? 9 : Number(key) - 1
  return listPlaceableStructures(options?.sandbox === true)[index] ?? null
}

/** Sidebar digit for a 0-based palette index (`1`…`9`, then `0`). */
export function hotkeyForStructureIndex(index: number): string | null {
  if (index < 0 || index > 9) return null
  return index === 9 ? '0' : String(index + 1)
}

export function getStructure(id: string): StructureDefinition | null {
  return structures.get(id) ?? null
}

export function defaultStructureId(): string {
  return order[0] ?? ''
}
