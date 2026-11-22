import { existsSync, watch, type FSWatcher } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { reloadGameConfig } from './load-game-config.ts'
import type { LoadedGameConfig } from './load-game-config.ts'

const DEBOUNCE_MS = 125

const SIBLING_CONFIG_FILES = new Set(['pipeline.toml', 'elements.toml'])

/**
 * Watches the config directory for `game.config.toml`, sibling `pipeline.toml`
 * and `elements.toml`, plus optional `elements/`. Calls `onChange` after each
 * successful reload.
 *
 * Watches the directory (not individual inodes) so editor atomic saves
 * (temp file + rename) keep firing on Linux.
 */
export function watchGameConfig(
  absolutePath: string,
  onChange: (config: LoadedGameConfig) => void,
): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  const configDir = dirname(absolutePath)
  const configBase = basename(absolutePath)

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

  const onDirEvent = (filename: string | null) => {
    if (!isRelevantConfigChange(configBase, filename)) return
    scheduleReload()
  }

  const watchers: FSWatcher[] = [watch(configDir, (_event, filename) => onDirEvent(filename))]
  const elementsDir = join(configDir, 'elements')
  if (existsSync(elementsDir)) {
    try {
      watchers.push(
        watch(elementsDir, { recursive: true }, (_event, filename) => {
          // Any change under elements/ is catalog input.
          if (filename && isEphemeralEditorPath(filename)) return
          scheduleReload()
        }),
      )
    } catch {
      // recursive may be unsupported; fall back to non-recursive.
      watchers.push(watch(elementsDir, (_event, filename) => onDirEvent(filename ? `elements/${filename}` : 'elements')))
    }
  }

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    for (const watcher of watchers) watcher.close()
  }
}

function isRelevantConfigChange(
  configBase: string,
  filename: string | null | undefined,
): boolean {
  // Some platforms omit the name; reload rather than miss an update.
  if (!filename) return true
  const normalized = filename.replaceAll('\\', '/')
  if (isEphemeralEditorPath(normalized)) return false
  const base = basename(normalized)
  if (base === configBase || SIBLING_CONFIG_FILES.has(base)) return true
  return normalized === 'elements' || normalized.startsWith('elements/')
}

function isEphemeralEditorPath(filename: string): boolean {
  const base = basename(filename.replaceAll('\\', '/'))
  return (
    base.startsWith('.') ||
    base.endsWith('~') ||
    base.endsWith('.tmp') ||
    base.endsWith('.swp') ||
    base.endsWith('.swx')
  )
}
