import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { loadGameConfig } from '../game-server/config/load-game-config.ts'

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
  const { rules } = loadGameConfig()
  assert.equal(rules.balanceCap, 20)
  assert.equal(rules.initialBalance, 20)
  assert.equal(rules.coinIntervalMs, 30_000)
  assert.equal(rules.sessionDurationMs, 604_800_000)
})

test('loads an explicit TOML path and maps configured values', () => {
  withToml(
    'balance_cap = 42\ninitial_balance = 12\ncoin_interval_ms = 45000\n',
    (configPath) => {
      const { rules } = loadGameConfig(configPath)
      assert.equal(rules.balanceCap, 42)
      assert.equal(rules.initialBalance, 12)
      assert.equal(rules.coinIntervalMs, 45_000)
    },
  )
})

test('rejects unknown TOML fields instead of silently ignoring them', () => {
  withToml('not_a_rule = 10\n', (configPath) => {
    assert.throws(() => loadGameConfig(configPath), /desconhecida: not_a_rule/)
  })
})

test('rejects values outside rule bounds and inconsistent rules', () => {
  withToml('quorum = 0\n', (configPath) => {
    assert.throws(() => loadGameConfig(configPath), /quorum deve ser número/)
  })
  withToml('balance_cap = 10\ninitial_balance = 11\n', (configPath) => {
    assert.throws(
      () => loadGameConfig(configPath),
      /initial_balance não pode exceder balance_cap/,
    )
  })
  withToml('bdfl_veto = true\n', (configPath) => {
    assert.throws(() => loadGameConfig(configPath), /bdfl_veto está reservado/)
  })
})
