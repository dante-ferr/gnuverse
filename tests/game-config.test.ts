import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { loadGameConfig } from '../game-server/config/load-game-config.ts'
import { pipelineRulesFrom } from '../game-server/pipeline/load-rules.ts'

function withToml(contents: string, run: (configPath: string) => void) {
  const directory = mkdtempSync(path.join(tmpdir(), 'gnuverse-game-config-'))
  const configPath = path.join(directory, 'rules.toml')
  try {
    writeFileSync(configPath, contents)
    run(configPath)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('loads the game-server configuration TOML and returns validated camelCase rules', () => {
  const { rules, pipeline } = loadGameConfig()
  assert.equal(rules.initialBalance, 120)
  assert.equal(pipeline.passiveCap, 120)
  assert.equal(pipeline.walletCap, 1_000_000_000)
  assert.equal(pipeline.coinsPerMinute, 12)
  assert.equal(pipeline.beltCost, 1)
  assert.equal(pipeline.fastTunnelCost, 18)
  assert.equal(rules.sessionDurationMs, 604_800_000)
})

test('loads an explicit TOML path and maps configured values', () => {
  withToml(
    'initial_balance = 12\n[pipeline]\nwallet_cap = 42\npassive_cap = 20\ncoins_per_minute = 2\n',
    (configPath) => {
      const { rules, pipeline } = loadGameConfig(configPath)
      assert.equal(rules.initialBalance, 12)
      assert.equal(pipeline.walletCap, 42)
      assert.equal(pipeline.passiveCap, 20)
      assert.equal(pipeline.coinsPerMinute, 2)
    },
  )
})

test('loads chunk expansion keys in the pipeline table and rejects unknown pipeline keys', () => {
  withToml(
    '[pipeline]\nchunk_size = 24\nmap_chunk_extent = 32\nchunk_cost_base = 10\nchunk_cost_step = 3\n',
    (configPath) => {
      const { pipeline } = loadGameConfig(configPath)
      assert.equal(pipeline.chunkSize, 24)
      assert.equal(pipeline.mapChunkExtent, 32)
      assert.equal(pipeline.chunkCostBase, 10)
      assert.equal(pipeline.chunkCostStep, 3)
    },
  )
  assert.throws(() => pipelineRulesFrom({ mystery_pipeline_key: 1 }), /desconhecida: pipeline\.mystery_pipeline_key/)
  assert.throws(
    () => pipelineRulesFrom({ chunk_size: 4 }),
    /chunk_size deve ser inteiro entre 8 e 64/,
  )
})

test('rejects unknown TOML fields instead of silently ignoring them', () => {
  withToml('not_a_rule = 10\n', (configPath) => {
    assert.throws(() => loadGameConfig(configPath), /desconhecida: not_a_rule/)
  })
})

test('rejects values outside rule bounds and inconsistent rules', () => {
  withToml('initial_balance = 11\n[pipeline]\npassive_cap = 10\nwallet_cap = 100\n', (configPath) => {
    assert.throws(
      () => loadGameConfig(configPath),
      /initial_balance não pode exceder passive_cap/,
    )
  })
  withToml('[pipeline]\npassive_cap = 50\nwallet_cap = 10\n', (configPath) => {
    assert.throws(
      () => loadGameConfig(configPath),
      /passive_cap não pode exceder wallet_cap/,
    )
  })
  withToml('bdfl_veto = true\n', (configPath) => {
    assert.throws(() => loadGameConfig(configPath), /bdfl_veto está reservado/)
  })
})