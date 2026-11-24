import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveCMSBaseURL,
  resolveGameAllowedOrigins,
  resolveGameDatabaseURL,
  resolveGameHost,
  resolveGamePort,
} from '../game-server/config/runtime-env.ts'

test('resolveGameDatabaseURL prefers GAME_DATABASE_URL, then DATABASE_URL, unless sqlite is forced', () => {
  assert.equal(
    resolveGameDatabaseURL({
      GAME_DATABASE_URL: 'postgres://game',
      DATABASE_URL: 'postgres://shared',
    }),
    'postgres://game',
  )
  assert.equal(
    resolveGameDatabaseURL({ DATABASE_URL: 'postgres://shared' }),
    'postgres://shared',
  )
  assert.equal(
    resolveGameDatabaseURL({
      GAME_DB_ADAPTER: 'sqlite',
      DATABASE_URL: 'postgres://shared',
    }),
    undefined,
  )
  assert.equal(resolveGameDatabaseURL({}), undefined)
})

test('resolveGamePort prefers GAME_PORT, then PORT, then 3002', () => {
  assert.equal(resolveGamePort({ GAME_PORT: '4000', PORT: '10000' }), 4000)
  assert.equal(resolveGamePort({ PORT: '10000' }), 10000)
  assert.equal(resolveGamePort({ GAME_PORT: '  ', PORT: '' }), 3002)
  assert.equal(resolveGamePort({}), 3002)
})

test('resolveGameHost defaults to 0.0.0.0 when PORT or production is set', () => {
  assert.equal(resolveGameHost({ GAME_HOST: '127.0.0.1', PORT: '10000' }), '127.0.0.1')
  assert.equal(resolveGameHost({ PORT: '10000' }), '0.0.0.0')
  assert.equal(resolveGameHost({ NODE_ENV: 'production' }), '0.0.0.0')
  assert.equal(resolveGameHost({}), '127.0.0.1')
})

test('resolveCMSBaseURL falls back to CMS_SERVER_URL, NEXT_PUBLIC_CMS_URL, then localhost', () => {
  assert.equal(
    resolveCMSBaseURL({ CMS_URL: 'https://cms.example.com/', CMS_SERVER_URL: 'https://other.example.com' }),
    'https://cms.example.com',
  )
  assert.equal(
    resolveCMSBaseURL({ CMS_SERVER_URL: 'https://gnuverse.onrender.com/' }),
    'https://gnuverse.onrender.com',
  )
  assert.equal(
    resolveCMSBaseURL({ NEXT_PUBLIC_CMS_URL: 'https://gnuverse.onrender.com' }),
    'https://gnuverse.onrender.com',
  )
  assert.equal(resolveCMSBaseURL({ CMS_PORT: '3101' }), 'http://localhost:3101')
  assert.equal(resolveCMSBaseURL({}), 'http://localhost:3001')
})

test('resolveGameAllowedOrigins falls back to CMS_ALLOWED_ORIGINS, GNUVERSE_SITE_URL, then localhost', () => {
  assert.deepEqual(
    resolveGameAllowedOrigins({
      GAME_ALLOWED_ORIGINS: 'https://a.example.com/, https://b.example.com',
      CMS_ALLOWED_ORIGINS: 'https://c.example.com',
    }),
    ['https://a.example.com', 'https://b.example.com'],
  )
  assert.deepEqual(
    resolveGameAllowedOrigins({
      CMS_ALLOWED_ORIGINS: 'https://gnuverse.vercel.app/',
    }),
    ['https://gnuverse.vercel.app'],
  )
  assert.deepEqual(
    resolveGameAllowedOrigins({
      GNUVERSE_SITE_URL: 'https://gnuverse.vercel.app/',
    }),
    ['https://gnuverse.vercel.app'],
  )
  assert.deepEqual(resolveGameAllowedOrigins({}), [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ])
})
