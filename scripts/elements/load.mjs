/**
 * Load and validate Open Pipeline element recipe books from TOML.
 * Discovers `game-server/config/elements.toml` and any `*.toml` under
 * `game-server/config/elements/`, then merges them into one catalog.
 *
 * Schema:
 * - Tier 1: bases (no inputs)
 * - Crafted: inputs length 2 or 3; outputs defaults to [id], length 1 or 2
 * - Co-products: coproduct_of = primary id (no inputs); must appear in primary.outputs
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'

/**
 * @typedef {{
 *   id: string,
 *   name_pt: string,
 *   tier: number,
 *   color: string,
 *   inputs: string[],
 *   outputs: string[],
 *   coproduct_of: string | null,
 *   sourceFile: string,
 * }} Element
 * @typedef {{
 *   maxTier: number,
 *   elements: Element[],
 *   byId: Map<string, Element>,
 *   recipes: Element[],
 *   sources: string[],
 * }} ElementCatalog
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

  let maxTier = 5
  /** @type {Element[]} */
  const elements = []

  for (const filePath of files) {
    const raw = parse(readFileSync(filePath, 'utf8'))
    if (raw.max_tier != null) maxTier = Number(raw.max_tier)
    const rows = Array.isArray(raw.elements) ? raw.elements : []
    for (const row of rows) {
      elements.push(normalizeElement(row, filePath, maxTier))
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
    validateElementLinks(el, byId, maxTier)
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
 * @returns {Element}
 */
function normalizeElement(row, sourceFile, maxTier) {
  const id = String(row.id ?? '').trim()
  if (!id) fail(`Element missing id in ${sourceFile}.`)
  const tier = Number(row.tier)
  if (!Number.isInteger(tier) || tier < 1 || tier > maxTier) {
    fail(`Element ${id}: tier must be 1..${maxTier}, got ${row.tier}`)
  }

  const coproductOf = row.coproduct_of == null ? null : String(row.coproduct_of).trim()
  const inputs = normalizeIdList(row.inputs, `Element ${id} inputs`)
  let outputs = normalizeIdList(row.outputs, `Element ${id} outputs`)

  if (coproductOf) {
    if (inputs.length > 0) fail(`Element ${id}: co-product must not list inputs.`)
    if (outputs.length > 0) fail(`Element ${id}: co-product must not list outputs.`)
    outputs = [id]
  } else if (tier === 1) {
    if (inputs.length > 0) fail(`Element ${id}: tier 1 must not have inputs.`)
    if (outputs.length === 0) outputs = [id]
  } else {
    if (inputs.length !== 2 && inputs.length !== 3) {
      fail(`Element ${id}: expected 2 or 3 inputs, got ${inputs.length}.`)
    }
    if (new Set(inputs).size !== inputs.length) {
      fail(`Element ${id}: inputs must be distinct.`)
    }
    if (outputs.length === 0) outputs = [id]
    if (outputs.length > 2) fail(`Element ${id}: at most 2 outputs.`)
    if (!outputs.includes(id)) {
      fail(`Element ${id}: outputs must include its own id.`)
    }
    if (new Set(outputs).size !== outputs.length) {
      fail(`Element ${id}: outputs must be distinct.`)
    }
  }

  return {
    id,
    name_pt: String(row.name_pt ?? id),
    tier,
    color: row.color ? String(row.color) : defaultColor(tier),
    inputs,
    outputs,
    coproduct_of: coproductOf,
    sourceFile,
  }
}

/**
 * @param {Element} el
 * @param {Map<string, Element>} byId
 * @param {number} maxTier
 */
function validateElementLinks(el, byId, maxTier) {
  if (el.coproduct_of) {
    const primary = byId.get(el.coproduct_of)
    if (!primary) fail(`Element ${el.id}: unknown coproduct_of "${el.coproduct_of}".`)
    if (primary.inputs.length === 0) {
      fail(`Element ${el.id}: coproduct_of "${el.coproduct_of}" is not a crafted recipe.`)
    }
    if (!primary.outputs.includes(el.id)) {
      fail(`Element ${el.id}: primary "${primary.id}" outputs must include this co-product.`)
    }
    if (primary.tier !== el.tier) {
      fail(`Element ${el.id}: co-product tier must match primary (${primary.tier}).`)
    }
    return
  }

  for (const inputId of el.inputs) {
    if (!byId.has(inputId)) fail(`Element ${el.id}: unknown input "${inputId}".`)
    if (inputId === el.id) fail(`Element ${el.id}: self-input.`)
  }

  for (const outputId of el.outputs) {
    if (!byId.has(outputId)) fail(`Element ${el.id}: unknown output "${outputId}".`)
  }

  if (el.outputs.length === 2) {
    const other = el.outputs.find((id) => id !== el.id)
    const co = byId.get(other)
    if (!co?.coproduct_of) {
      fail(`Element ${el.id}: secondary output "${other}" must set coproduct_of = "${el.id}".`)
    }
    if (co.coproduct_of !== el.id) {
      fail(`Element ${el.id}: secondary output "${other}" points at "${co.coproduct_of}".`)
    }
  }

  if (el.inputs.length > 0) {
    const expected = 1 + Math.max(...el.inputs.map((id) => byId.get(id).tier))
    if (el.tier !== expected) {
      fail(
        `Element ${el.id}: tier ${el.tier} does not match 1 + max(input tiers) = ${expected}.`,
      )
    }
    if (el.tier > maxTier) fail(`Element ${el.id}: tier exceeds max_tier ${maxTier}.`)
  }
}

/** @param {unknown} value @param {string} label */
function normalizeIdList(value, label) {
  if (value == null) return []
  if (!Array.isArray(value)) fail(`${label} must be an array, got ${typeof value}`)
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
    const el = byId.get(id)
    const deps = el.coproduct_of ? byId.get(el.coproduct_of).inputs : el.inputs
    for (const inputId of deps) dfs(inputId)
    visiting.delete(id)
    visited.add(id)
  }

  for (const id of byId.keys()) dfs(id)
}

/** @param {number} tier */
function defaultColor(tier) {
  const palette = ['#9aa0a6', '#4aa8ff', '#5ecf6a', '#c4a574', '#5b6abf', '#d9480f']
  return palette[Math.min(tier, palette.length - 1)]
}

/** @param {string} message */
function fail(message) {
  const error = new Error(`elements.toml: ${message}`)
  error.name = 'ElementCatalogError'
  throw error
}
