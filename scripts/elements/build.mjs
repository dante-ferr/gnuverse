#!/usr/bin/env node
/**
 * Write a static HTML snapshot of the element recipe page.
 * Prefer `npm run elements:serve` while editing recipes.
 *
 * Usage: npm run elements:build
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadElementCatalog } from './load.mjs'
import { renderElementsPage } from './render.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const configDir = join(root, 'game-server/config')
const outPath = join(configDir, 'elements-graph.html')

const catalog = loadElementCatalog(configDir)
const html = renderElementsPage(catalog)
mkdirSync(configDir, { recursive: true })
writeFileSync(outPath, html)

console.log(
  `Elements: ${catalog.elements.length} (${catalog.recipes.length} recipes), max tier ${catalog.maxTier}`,
)
for (let t = 1; t <= catalog.maxTier; t++) {
  const ids = catalog.elements.filter((e) => e.tier === t).map((e) => e.id)
  if (ids.length) console.log(`  T${t} (${ids.length}): ${ids.join(', ')}`)
}
console.log(`Wrote ${outPath}`)
