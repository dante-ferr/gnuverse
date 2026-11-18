/**
 * Load and validate Open Pipeline element recipe books from TOML.
 * Discovers `game-server/config/elements.toml` and any `*.toml` under
 * `game-server/config/elements/`, then merges them into one catalog.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'

/**
 * @typedef {{ id: string, name_pt: string, tier: number, color: string, inputs: string[], sourceFile: string }} Element
 * @typedef {{ maxTier: number, combinerInputs: number, elements: Element[], byId: Map<string, Element>, recipes: Element[], sources: string[] }} ElementCatalog
 */

/**
 * @param {string} configDir absolute path to game-server/config
 * @returns {ElementCatalog}
 */
export function loadElementCatalog(configDir) {
  const files = discoverTomlFiles(configDir)
  if (files.length === 0) {
    fail(`No element TOML found under ${configDir}`)
  }

  let maxTier = 4
  let combinerInputs = 2
  /** @type {Element[]} */
  const elements = []

  for (const filePath of files) {
    const raw = parse(readFileSync(filePath, 'utf8'))
    if (raw.max_tier != null) maxTier = Number(raw.max_tier)
    if (raw.combiner_inputs != null) combinerInputs = Number(raw.combiner_inputs)
    const rows = Array.isArray(raw.elements) ? raw.elements : []
    for (const row of rows) {
      elements.push(normalizeElement(row, filePath, maxTier, combinerInputs))
    }
  }

  if (elements.length === 0) fail('No [[elements]] entries found in TOML sources.')

  /** @type {Map<string, Element>} */
  const byId = new Map()
  for (const el of elements) {
    if (byId.has(el.id)) fail(`Duplicate element id "${el.id}" (${el.sourceFile}).`)
    byId.set(el.id, el)
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

  assertAcyclic(byId)

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
  const recipes = sorted.filter((el) => el.inputs.length > 0)

  return {
    maxTier,
    combinerInputs,
    elements: sorted,
    byId,
    recipes,
    sources: files,
  }
}

/** @param {string} configDir */
function discoverTomlFiles(configDir) {
  /** @type {string[]} */
  const files = []
  const rootFile = join(configDir, 'elements.toml')
  if (existsSync(rootFile) && statSync(rootFile).isFile()) files.push(rootFile)

  const dir = join(configDir, 'elements')
  if (existsSync(dir) && statSync(dir).isDirectory()) {
    collectTomlRecursive(dir, files)
  }

  return [...new Set(files)].sort()
}

/** @param {string} dir @param {string[]} out */
function collectTomlRecursive(dir, out) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) collectTomlRecursive(path, out)
    else if (st.isFile() && name.endsWith('.toml')) out.push(path)
  }
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} sourceFile
 * @param {number} maxTier
 * @param {number} combinerInputs
 * @returns {Element}
 */
function normalizeElement(row, sourceFile, maxTier, combinerInputs) {
  const id = String(row.id ?? '').trim()
  if (!id) fail(`Element missing id in ${sourceFile}.`)
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
  return {
    id,
    name_pt: String(row.name_pt ?? id),
    tier,
    color: row.color ? String(row.color) : defaultColor(tier),
    inputs,
    sourceFile,
  }
}

/** @param {unknown} value */
function normalizeInputs(value) {
  if (value == null) return []
  if (!Array.isArray(value)) fail(`inputs must be an array, got ${typeof value}`)
  return value.map((v) => String(v).trim()).filter(Boolean)
}

/** @param {Map<string, Element>} byId */
function assertAcyclic(byId) {
  const visiting = new Set()
  const visited = new Set()

  /** @param {string} id */
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

/** @param {number} tier */
function defaultColor(tier) {
  const palette = ['#9aa0a6', '#4aa8ff', '#5ecf6a', '#c4a574', '#5b6abf']
  return palette[Math.min(tier, palette.length - 1)]
}

/** @param {string} message */
function fail(message) {
  const error = new Error(`elements.toml: ${message}`)
  error.name = 'ElementCatalogError'
  throw error
}
