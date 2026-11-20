import assert from 'node:assert/strict'
import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { watchGameConfig } from '../game-server/config/watch-game-config.ts'

function writeConfigFixtures(directory: string) {
  const configPath = path.join(directory, 'game.config.toml')
  const pipelinePath = path.join(directory, 'pipeline.toml')
  writeFileSync(configPath, 'initial_balance = 10\n')
  writeFileSync(pipelinePath, 'color_core = "#111111"\npassive_cap = 120\n')
  return { configPath, pipelinePath }
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1500,
): Promise<void> {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Timed out waiting for config reload')
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

test('watchGameConfig reloads when sibling pipeline.toml changes', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'gnuverse-pipeline-reload-'))
  const { configPath, pipelinePath } = writeConfigFixtures(directory)
  const seen: string[] = []
  const unwatch = watchGameConfig(configPath, (loaded) => {
    seen.push(loaded.pipeline.colorCore)
  })
  try {
    writeFileSync(pipelinePath, 'color_core = "#abcdef"\npassive_cap = 120\n')
    await waitFor(() => seen.includes('#abcdef'))
  } finally {
    unwatch()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('watchGameConfig reloads when game.config.toml changes', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'gnuverse-config-reload-'))
  const { configPath } = writeConfigFixtures(directory)
  const seen: number[] = []
  const unwatch = watchGameConfig(configPath, (loaded) => {
    seen.push(loaded.rules.initialBalance)
  })
  try {
    writeFileSync(configPath, 'initial_balance = 42\n')
    await waitFor(() => seen.includes(42))
  } finally {
    unwatch()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('watchGameConfig keeps reloading after editor atomic saves', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'gnuverse-atomic-reload-'))
  const { configPath, pipelinePath } = writeConfigFixtures(directory)
  const seen: string[] = []
  const unwatch = watchGameConfig(configPath, (loaded) => {
    seen.push(loaded.pipeline.colorCore)
  })
  try {
    for (const color of ['#aaaaaa', '#bbbbbb', '#cccccc'] as const) {
      const tempPath = `${pipelinePath}.tmp`
      writeFileSync(tempPath, `color_core = "${color}"\npassive_cap = 120\n`)
      renameSync(tempPath, pipelinePath)
      await waitFor(() => seen.includes(color))
    }
    assert.ok(seen.includes('#aaaaaa'))
    assert.ok(seen.includes('#bbbbbb'))
    assert.ok(seen.includes('#cccccc'))
  } finally {
    unwatch()
    rmSync(directory, { recursive: true, force: true })
  }
})
