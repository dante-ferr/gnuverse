import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDevConfig } from '../scripts/dev-config.ts'

test('development connects frontend to the actual game port and authorizes custom site ports', () => {
  const config = getDevConfig({
    SITE_PORT: '4310',
    GAME_PORT: '4312',
    CMS_PORT: '4311',
    GAME_ALLOWED_ORIGINS: 'https://existing.example',
  })
  assert.equal(config.gameURL, 'http://localhost:4312')
  assert.equal(config.gamePort, '4312')
  assert.equal(config.sitePort, '4310')
  assert.deepEqual(config.allowedOrigins.split(','), [
    'https://existing.example',
    'http://localhost:4310',
    'http://127.0.0.1:4310',
  ])
})

test('development uses distinct default ports and rejects invalid or colliding ports', () => {
  assert.equal(getDevConfig({}).gameURL, 'http://localhost:3002')
  for (const GAME_PORT of ['0', '65536', 'oops', '3000', '3001']) {
    assert.throws(() => getDevConfig({ GAME_PORT }), /porta/)
  }
})
