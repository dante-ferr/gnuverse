import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getCMSPort, getContentCMSURL, getLocalCMSURL, loadLocalEnvironment } from '../cms/scripts/local-config.mjs'

test('uma porta alterada determina a URL local e a origem de conteúdo', () => {
  const env = { CMS_PORT: '4317' }
  assert.equal(getCMSPort(env), '4317')
  assert.equal(getLocalCMSURL(env), 'http://localhost:4317')
  assert.equal(getContentCMSURL(env), getLocalCMSURL(env))
})

test('produção usa a origem remota sem exigir porta de desenvolvimento', () => {
  assert.equal(getContentCMSURL({ CMS_URL: 'https://cms.example.test' }), 'https://cms.example.test')
})

test('porta ausente ou inválida falha em vez de iniciar na porta errada', () => {
  for (const CMS_PORT of [undefined, '', '0', '65536', '4317abc']) {
    assert.throws(() => getCMSPort({ CMS_PORT }), /CMS_PORT/)
  }
})

test('ambiente da raiz não marca o .env do CMS como já processado', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'gnuverse-env-check-'))
  const keys = ['__NEXT_PROCESSED_ENV', 'PAYLOAD_SECRET', 'CMS_PORT']
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  try {
    await writeFile(path.join(directory, '.env.local'), 'CMS_PORT=4317\n')
    await writeFile(path.join(directory, 'cms.env'), 'PAYLOAD_SECRET=regression-test-only\n')
    for (const key of keys) delete process.env[key]
    loadLocalEnvironment(directory)
    assert.equal(process.env.__NEXT_PROCESSED_ENV, undefined)
    process.loadEnvFile(path.join(directory, 'cms.env'))
    assert.equal(process.env.PAYLOAD_SECRET, 'regression-test-only')
    assert.equal(process.env.CMS_PORT, '4317')
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
    await rm(directory, { recursive: true, force: true })
  }
})
