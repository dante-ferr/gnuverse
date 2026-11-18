#!/usr/bin/env node
/**
 * Read game-server/config/elements.toml, validate the recipe DAG, and write
 * an HTML Mermaid graph plus a Mermaid snippet for docs.
 *
 * Usage: node scripts/visualize-elements.mjs
 *        npm run elements:graph
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'smol-toml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tomlPath = join(root, 'game-server/config/elements.toml')
const outDir = join(root, 'game-server/config')
const htmlPath = join(outDir, 'elements-graph.html')
const mermaidPath = join(outDir, 'elements-graph.mmd')

const raw = parse(readFileSync(tomlPath, 'utf8'))
const maxTier = Number(raw.max_tier ?? 4)
const combinerInputs = Number(raw.combiner_inputs ?? 2)
const elements = Array.isArray(raw.elements) ? raw.elements : []

if (elements.length === 0) {
  fail('No [[elements]] entries found.')
}

/** @type {Map<string, { id: string, name_pt: string, tier: number, color?: string, inputs: string[] }>} */
const byId = new Map()

for (const row of elements) {
  const id = String(row.id ?? '').trim()
  if (!id) fail('Element missing id.')
  if (byId.has(id)) fail(`Duplicate element id: ${id}`)
  const tier = Number(row.tier)
  if (!Number.isInteger(tier) || tier < 1 || tier > maxTier) {
    fail(`Element ${id}: tier must be 1..${maxTier}, got ${row.tier}`)
  }
  const inputs = normalizeInputs(row.inputs)
  if (tier === 1 && inputs.length > 0) {
    fail(`Element ${id}: tier 1 must not have inputs.`)
  }
  if (tier > 1 && inputs.length !== combinerInputs) {
    fail(`Element ${id}: expected ${combinerInputs} inputs, got ${inputs.length}.`)
  }
  byId.set(id, {
    id,
    name_pt: String(row.name_pt ?? id),
    tier,
    color: row.color ? String(row.color) : undefined,
    inputs,
  })
}

for (const el of byId.values()) {
  for (const inputId of el.inputs) {
    if (!byId.has(inputId)) fail(`Element ${el.id}: unknown input "${inputId}".`)
    if (inputId === el.id) fail(`Element ${el.id}: self-input.`)
  }
  if (el.inputs.length === combinerInputs) {
    const [a, b] = el.inputs
    if (a === b) fail(`Element ${el.id}: inputs must be distinct.`)
    const expected = 1 + Math.max(byId.get(a).tier, byId.get(b).tier)
    if (el.tier !== expected) {
      fail(
        `Element ${el.id}: tier ${el.tier} does not match 1 + max(input tiers) = ${expected}.`,
      )
    }
  }
}

assertAcyclic()

const recipeKeys = new Set()
for (const el of byId.values()) {
  if (el.inputs.length === 0) continue
  const key = [...el.inputs].sort().join('+')
  if (recipeKeys.has(key)) fail(`Duplicate recipe for inputs ${key}.`)
  recipeKeys.add(key)
}

const sorted = [...byId.values()].sort(
  (a, b) => a.tier - b.tier || a.id.localeCompare(b.id),
)
const recipeCount = sorted.filter((e) => e.inputs.length > 0).length

const mermaid = buildMermaid(sorted)
writeFileSync(mermaidPath, `${mermaid}\n`)
mkdirSync(outDir, { recursive: true })
writeFileSync(htmlPath, buildHtml(mermaid, sorted, maxTier, recipeCount))

console.log(`Elements: ${sorted.length} (${recipeCount} recipes), max tier ${maxTier}`)
for (let t = 1; t <= maxTier; t++) {
  const ids = sorted.filter((e) => e.tier === t).map((e) => e.id)
  console.log(`  T${t} (${ids.length}): ${ids.join(', ')}`)
}
console.log(`Wrote ${mermaidPath}`)
console.log(`Wrote ${htmlPath}`)
console.log('Open the HTML file in a browser to view the graph.')

/** @param {unknown} value */
function normalizeInputs(value) {
  if (value == null) return []
  if (!Array.isArray(value)) fail(`inputs must be an array, got ${typeof value}`)
  return value.map((v) => String(v).trim()).filter(Boolean)
}

function assertAcyclic() {
  const visiting = new Set()
  const visited = new Set()

  function dfs(id) {
    if (visited.has(id)) return
    if (visiting.has(id)) fail(`Cycle detected at ${id}.`)
    visiting.add(id)
    for (const inputId of byId.get(id).inputs) dfs(inputId)
    visiting.delete(id)
    visited.add(id)
  }

  for (const id of byId.keys()) dfs(id)
}

/** @param {ReturnType<typeof byId.get>[]} list */
function buildMermaid(list) {
  const lines = [
    'flowchart BT',
    '  %% Open Pipeline element recipes (generated; do not edit by hand)',
  ]

  for (let t = 1; t <= maxTier; t++) {
    const tierEls = list.filter((e) => e.tier === t)
    lines.push(`  subgraph T${t}["Tier ${t}"]`)
    for (const el of tierEls) {
      const label = `${el.name_pt}<br/><small>${el.id}</small>`
      lines.push(`    ${el.id}["${label}"]`)
    }
    lines.push('  end')
  }

  for (const el of list) {
    if (el.inputs.length === 0) continue
    for (const inputId of el.inputs) {
      lines.push(`  ${inputId} --> ${el.id}`)
    }
  }

  for (const el of list) {
    if (!el.color) continue
    lines.push(`  style ${el.id} fill:${el.color},stroke:#0a1014,color:#0a1014`)
  }

  return lines.join('\n')
}

/**
 * @param {string} diagram
 * @param {ReturnType<typeof byId.get>[]} list
 * @param {number} tierCap
 * @param {number} recipes
 */
function buildHtml(diagram, list, tierCap, recipes) {
  const recipeRows = list
    .filter((e) => e.inputs.length > 0)
    .map((e) => {
      const left = e.inputs.map((id) => byId.get(id).name_pt).join(' + ')
      return `<tr><td>T${e.tier}</td><td>${left}</td><td><strong>${e.name_pt}</strong> <code>${e.id}</code></td></tr>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Open Pipeline — element recipes</title>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({ startOnLoad: true, theme: "neutral", flowchart: { curve: "basis" } });
  </script>
  <style>
    :root { color-scheme: light; font-family: "Segoe UI", system-ui, sans-serif; }
    body { margin: 0; padding: 1.5rem; background: #f4f7f8; color: #0a1014; }
    h1 { font-size: 1.35rem; margin: 0 0 0.35rem; }
    p { margin: 0 0 1rem; color: #445; }
    .panel { background: #fff; border: 1px solid #c5d0d6; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    table { border-collapse: collapse; width: 100%; font-size: 0.95rem; }
    th, td { text-align: left; padding: 0.4rem 0.55rem; border-bottom: 1px solid #e2e8eb; }
    th { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: #567; }
    code { font-size: 0.85em; }
    .mermaid { overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Open Pipeline element recipes</h1>
  <p>${list.length} elements · ${recipes} recipes · max tier ${tierCap} · source <code>elements.toml</code></p>
  <div class="panel">
    <pre class="mermaid">
${diagram.replace(/</g, '&lt;')}
    </pre>
  </div>
  <div class="panel">
    <table>
      <thead><tr><th>Tier</th><th>Inputs</th><th>Output</th></tr></thead>
      <tbody>
${recipeRows}
      </tbody>
    </table>
  </div>
</body>
</html>
`
}

/** @param {string} message */
function fail(message) {
  console.error(`elements.toml: ${message}`)
  process.exit(1)
}
