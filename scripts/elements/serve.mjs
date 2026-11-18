#!/usr/bin/env node
/**
 * Local page for the Open Pipeline element recipe book.
 * Each request reloads TOML → HTML, so edits show up on refresh.
 *
 * Usage: npm run elements:serve
 *        ELEMENTS_PORT=3010 node scripts/elements/serve.mjs
 */

import { createServer } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadElementCatalog } from './load.mjs'
import { renderElementsPage } from './render.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const configDir = join(root, 'game-server/config')
const port = Number(process.env.ELEMENTS_PORT || 3010)

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
  if (url.pathname !== '/' && url.pathname !== '/index.html') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found. Open / for the element recipe page.\n')
    return
  }

  try {
    const catalog = loadElementCatalog(configDir)
    const html = renderElementsPage(catalog)
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    res.end(html)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<!doctype html><meta charset="utf-8" /><title>Element catalog error</title>
<pre style="white-space:pre-wrap;font:14px/1.4 ui-monospace,monospace;padding:1.5rem">${escapeHtml(message)}</pre>`)
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Element recipes: http://127.0.0.1:${port}/`)
  console.log(`Reading TOML from ${configDir} (and optional elements/ subdirectory)`)
  console.log('Edit the TOML files, then refresh the page.')
})

/** @param {string} value */
function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
