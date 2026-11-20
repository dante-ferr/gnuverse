import { watch, type FSWatcher } from 'node:fs'
import { dirname, join } from 'node:path'
import { reloadGameConfig } from './load-game-config.ts'
import type { LoadedGameConfig } from './load-game-config.ts'

const DEBOUNCE_MS = 125

/**
 * Watches `game.config.toml`, sibling `pipeline.toml` and `elements.toml`
 * (plus optional `elements/`). Calls `onChange` after each successful reload.
 */
export function watchGameConfig(
  absolutePath: string,
  onChange: (config: LoadedGameConfig) => void,
): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  const configDir = dirname(absolutePath)
  const scheduleReload = () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      try {
        onChange(reloadGameConfig(absolutePath))
      } catch (error) {
        console.error('Failed to reload game config:', error)
      }
    }, DEBOUNCE_MS)
  }

  const watchers: FSWatcher[] = [watch(absolutePath, scheduleReload)]
  for (const name of ['pipeline.toml', 'elements.toml'] as const) {
    try {
      watchers.push(watch(join(configDir, name), scheduleReload))
    } catch {
      // Sibling may be absent (test fixtures, custom GAME_CONFIG_PATH).
    }
  }
  try {
    watchers.push(watch(join(configDir, 'elements'), { recursive: true }, scheduleReload))
  } catch {
    // Optional elements/ directory may be absent.
  }

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    for (const watcher of watchers) watcher.close()
  }
}
