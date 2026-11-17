import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { watchGameConfig } from '../game-server/config/watch-game-config.ts'

test('watchGameConfig applies pipeline changes after debounce', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'gnuverse-config-reload-'))
  const configPath = path.join(directory, 'game.config.toml')
  writeFileSync(configPath, '[pipeline]\ncolor_core = "#111111"\n')
  const seen: string[] = []
  const unwatch = watchGameConfig(configPath, (loaded) => {
    seen.push(loaded.pipeline.colorCore)
  })
  try {
    writeFileSync(configPath, '[pipeline]\ncolor_core = "#222222"\n')
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.ok(seen.includes('#222222'))
  } finally {
    unwatch()
    rmSync(directory, { recursive: true, force: true })
  }
})