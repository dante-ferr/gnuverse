import type { TreeRules } from '../../../../game-server/config/load-game-config.ts'

export type { TreeRules }

export function parseTreeRules(
  rules: Record<string, unknown> | null | undefined,
): TreeRules | null {
  if (!rules || typeof rules !== 'object') return null
  const tree = rules.tree
  if (!tree || typeof tree !== 'object') return null
  return tree as TreeRules
}