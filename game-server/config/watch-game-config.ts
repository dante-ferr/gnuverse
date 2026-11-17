import { watch } from 'node:fs'
import { reloadGameConfig } from './load-game-config.ts'
import type { LoadedGameConfig } from './load-game-config.ts'

const DEBOUNCE_MS = 125

/** Watches a config file and calls `onChange` after each successful reload. */
export function watchGameConfig(
  absolutePath: string,
  onChange: (config: LoadedGameConfig) => void,
): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  const watcher = watch(absolutePath, () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      try {
        onChange(reloadGameConfig(absolutePath))
      } catch (error) {
        console.error('Failed to reload game config:', error)
      }
    }, DEBOUNCE_MS)
  })
  return () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    watcher.close()
  }
}