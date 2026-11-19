#!/usr/bin/env node
/**
 * Local page for the Open Pipeline element recipe book.
 * Each request reloads TOML → HTML, so edits show up on refresh.
 *
 * Usage: npm run elements:serve
 *        ELEMENTS_PORT=3010 node scripts/elements/serve.mjs
 */

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadElementCatalog } from './load.mjs'
import { renderElementsPage } from './render.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const configDir = join(root, 'game-server/config')
const pipelinePublicRoot = resolve(join(root, 'public/pipeline'))
const port = Number(process.env.ELEMENTS_PORT || 3010)

const MIME_BY_EXT = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)

  if (url.pathname.startsWith('/pipeline/')) {
    servePipelineAsset(url.pathname, res)
    return
  }

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

/**
 * @param {string} pathname
 * @param {import('node:http').ServerResponse} res
 */
function servePipelineAsset(pathname, res) {
  const rel = pathname.slice('/pipeline/'.length)
  if (!rel || rel.includes('..')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found.\n')
    return
  }

  const filePath = resolve(pipelinePublicRoot, rel)
  const allowedPrefix = pipelinePublicRoot.endsWith(sep)
    ? pipelinePublicRoot
    : pipelinePublicRoot + sep
  if (!filePath.startsWith(allowedPrefix)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found.\n')
    return
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found.\n')
    return
  }

  const ext = extname(filePath).toLowerCase()
  const type = MIME_BY_EXT[ext] ?? 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600' })
  createReadStream(filePath).pipe(res)
}

server.listen(port, '127.0.0.1', () => {
  console.log(`Element recipes: http://127.0.0.1:${port}/`)
  console.log(`Reading TOML from ${configDir} (and optional elements/ subdirectory)`)
  console.log('Static glyphs: /pipeline/* from public/pipeline/')
  console.log('Edit the TOML files, then refresh the page.')
})

/** @param {string} value */
function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}