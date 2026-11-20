import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { watchGameConfig } from '../game-server/config/watch-game-config.ts'

test('watchGameConfig reloads when sibling pipeline.toml changes', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'gnuverse-pipeline-reload-'))
  const configPath = path.join(directory, 'game.config.toml')
  const pipelinePath = path.join(directory, 'pipeline.toml')
  writeFileSync(configPath, 'initial_balance = 10\n')
  writeFileSync(pipelinePath, 'color_core = "#111111"\npassive_cap = 120\n')
  const seen: string[] = []
  const unwatch = watchGameConfig(configPath, (loaded) => {
    seen.push(loaded.pipeline.colorCore)
  })
  try {
    writeFileSync(pipelinePath, 'color_core = "#abcdef"\npassive_cap = 120\n')
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.ok(seen.includes('#abcdef'))
  } finally {
    unwatch()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('watchGameConfig reloads when game.config.toml changes', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'gnuverse-config-reload-'))
  const configPath = path.join(directory, 'game.config.toml')
  const pipelinePath = path.join(directory, 'pipeline.toml')
  writeFileSync(configPath, 'initial_balance = 10\n')
  writeFileSync(pipelinePath, 'passive_cap = 120\n')
  const seen: number[] = []
  const unwatch = watchGameConfig(configPath, (loaded) => {
    seen.push(loaded.rules.initialBalance)
  })
  try {
    writeFileSync(configPath, 'initial_balance = 42\n')
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.ok(seen.includes(42))
  } finally {
    unwatch()
    rmSync(directory, { recursive: true, force: true })
  }
})
