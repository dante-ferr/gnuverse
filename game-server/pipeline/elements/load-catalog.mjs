/**
 * Canonical Open Pipeline element catalog loader.
 * Used by game-server and by scripts/elements/* — keep content rules in TOML.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'smol-toml'

/**
 * @typedef {{
 *   id: string,
 *   name_pt: string,
 *   input_slots: number,
 *   output_slots: number,
 *   coupled_dual_output: boolean,
 *   split_single_across_ports: boolean,
 *   color: string,
 *   decor: string,
 *   default_rate_per_minute: number,
 * }} MachineKind
 * @typedef {{
 *   id: number,
 *   name_pt: string,
 *   summary_pt: string,
 *   max_new_bases: number,
 *   required_multiplier: number,
 * }} Chapter
 * @typedef {{
 *   id: string,
 *   name_pt: string,
 *   tier: number,
 *   family: string,
 *   sort_key: number,
 *   fill: string,
 *   stroke: string,
 *   glyph: string,
 *   glyph_size_px: number,
 *   inputs: string[],
 *   outputs: string[],
 *   coproduct_of: string | null,
 *   machine: string | null,
 *   rate_per_minute: number | null,
 *   productivity: number | null,
 *   demand_chapter: number,
 *   demand_required: number,
 *   source_rate_per_minute: number | null,
 *   source_spawn_chance_percent: number | null,
 *   sourceFile: string,
 * }} Element
 * @typedef {{
 *   node_width: number,
 *   node_height: number,
 *   column_gap: number,
 *   row_gap: number,
 *   highway_lane: number,
 * }} PreviewConfig
 * @typedef {{
 *   maxTier: number,
 *   retainPriorDemands: boolean,
 *   defaultRatePerMinute: number,
 *   defaultSourceRatePerMinute: number,
 *   defaultProductivity: number,
 *   defaultGlyphSizePx: number,
 *   defaultStroke: string,
 *   defaultDemandRequired: number,
 *   starterSourceIds: string[],
 *   preview: PreviewConfig,
 *   machines: MachineKind[],
 *   machinesById: Map<string, MachineKind>,
 *   chapters: Chapter[],
 *   elements: Element[],
 *   byId: Map<string, Element>,
 *   recipes: Element[],
 *   bases: Element[],
 *   sources: string[],
 * }} ElementCatalog
 */

const DEFAULT_PREVIEW = {
  node_width: 104,
  node_height: 52,
  column_gap: 72,
  row_gap: 18,
  highway_lane: 16,
}

/** Absolute path to game-server/config (default when no arg). */
export function defaultElementsConfigDir() {
  return join(dirname(fileURLToPath(import.meta.url)), '../../config')
}

/**
 * @param {string} [configDir]
 * @returns {ElementCatalog}
 */
export function loadElementCatalog(configDir = defaultElementsConfigDir()) {
  const files = discoverTomlFiles(configDir)
  if (files.length === 0) fail(`No element TOML found under ${configDir}`)

  /** @type {Partial<ElementCatalog>} */
  const globals = {
    maxTier: 5,
    retainPriorDemands: true,
    defaultRatePerMinute: 60,
    defaultSourceRatePerMinute: 60,
    defaultProductivity: 1,
    defaultGlyphSizePx: 28,
    defaultStroke: '#0a1014',
    defaultDemandRequired: 20,
    starterSourceIds: [],
    preview: { ...DEFAULT_PREVIEW },
  }
  /** @type {MachineKind[]} */
  const machines = []
  /** @type {Chapter[]} */
  const chapters = []
  /** @type {Element[]} */
  const elements = []

  for (const filePath of files) {
    const raw = parse(readFileSync(filePath, 'utf8'))
    mergeGlobals(globals, raw)
    if (raw.preview && typeof raw.preview === 'object') {
      globals.preview = { ...globals.preview, ...normalizePreview(raw.preview) }
    }
    for (const row of asArray(raw.machines)) machines.push(normalizeMachine(row, filePath, globals))
    for (const row of asArray(raw.chapters)) chapters.push(normalizeChapter(row, filePath))
    for (const row of asArray(raw.elements)) {
      elements.push(normalizeElement(row, filePath, globals))
    }
  }

  if (elements.length === 0) fail('No [[elements]] entries found in TOML sources.')
  if (machines.length === 0) fail('No [[machines]] entries. Crafted recipes need a machine id.')

  /** @type {Map<string, MachineKind>} */
  const machinesById = new Map()
  for (const machine of machines) {
    if (machinesById.has(machine.id)) fail(`Duplicate machine id "${machine.id}".`)
    machinesById.set(machine.id, machine)
  }

  /** @type {Map<string, Element>} */
  const byId = new Map()
  for (const el of elements) {
    if (byId.has(el.id)) fail(`Duplicate element id "${el.id}" (${el.sourceFile}).`)
    byId.set(el.id, el)
  }

  for (const el of byId.values()) validateElementLinks(el, byId, machinesById, globals.maxTier)

  const orderedChapters = validateChapters(chapters, byId)
  assertAcyclic(byId)
  validateStarters(globals.starterSourceIds, byId)

  const recipeKeys = new Set()
  for (const el of byId.values()) {
    if (el.inputs.length === 0) continue
    const key = [...el.inputs].sort().join('+')
    if (recipeKeys.has(key)) fail(`Duplicate recipe for inputs ${key}.`)
    recipeKeys.add(key)
  }

  const sorted = [...byId.values()].sort(
    (a, b) => a.sort_key - b.sort_key || a.tier - b.tier || a.id.localeCompare(b.id),
  )

  return {
    maxTier: globals.maxTier,
    retainPriorDemands: globals.retainPriorDemands,
    defaultRatePerMinute: globals.defaultRatePerMinute,
    defaultSourceRatePerMinute: globals.defaultSourceRatePerMinute,
    defaultProductivity: globals.defaultProductivity,
    defaultGlyphSizePx: globals.defaultGlyphSizePx,
    defaultStroke: globals.defaultStroke,
    defaultDemandRequired: globals.defaultDemandRequired,
    starterSourceIds: [...globals.starterSourceIds],
    preview: globals.preview,
    machines: [...machinesById.values()],
    machinesById,
    chapters: orderedChapters,
    elements: sorted,
    byId,
    recipes: sorted.filter((el) => el.inputs.length > 0),
    bases: sorted.filter((el) => el.tier === 1 && !el.coproduct_of),
    sources: files,
  }
}

/** JSON-safe catalog for rules / SSE payloads. */
export function catalogToJson(catalog) {
  return {
    maxTier: catalog.maxTier,
    retainPriorDemands: catalog.retainPriorDemands,
    defaultRatePerMinute: catalog.defaultRatePerMinute,
    defaultSourceRatePerMinute: catalog.defaultSourceRatePerMinute,
    defaultProductivity: catalog.defaultProductivity,
    defaultGlyphSizePx: catalog.defaultGlyphSizePx,
    defaultStroke: catalog.defaultStroke,
    defaultDemandRequired: catalog.defaultDemandRequired,
    starterSourceIds: catalog.starterSourceIds,
    preview: catalog.preview,
    machines: catalog.machines,
    chapters: catalog.chapters,
    elements: catalog.elements.map(({ sourceFile: _s, ...el }) => el),
  }
}

/** @param {Partial<ElementCatalog>} globals @param {Record<string, unknown>} raw */
function mergeGlobals(globals, raw) {
  if (raw.max_tier != null) globals.maxTier = Number(raw.max_tier)
  if (raw.retain_prior_demands != null) globals.retainPriorDemands = Boolean(raw.retain_prior_demands)
  if (raw.default_rate_per_minute != null) {
    globals.defaultRatePerMinute = ratePerMinute(raw.default_rate_per_minute, 'default_rate_per_minute')
  }
  if (raw.default_source_rate_per_minute != null) {
    globals.defaultSourceRatePerMinute = ratePerMinute(
      raw.default_source_rate_per_minute,
      'default_source_rate_per_minute',
    )
  }
  if (raw.default_productivity != null) {
    globals.defaultProductivity = Number(raw.default_productivity)
  }
  if (raw.default_glyph_size_px != null) {
    globals.defaultGlyphSizePx = int(raw.default_glyph_size_px, 'default_glyph_size_px', 1)
  }
  if (raw.default_stroke != null) globals.defaultStroke = String(raw.default_stroke)
  if (raw.default_demand_required != null) {
    globals.defaultDemandRequired = int(raw.default_demand_required, 'default_demand_required', 1)
  }
  if (raw.starter_source_ids != null) {
    globals.starterSourceIds = normalizeIdList(raw.starter_source_ids, 'starter_source_ids')
  }
}

/** @param {Record<string, unknown>} row */
function normalizePreview(row) {
  return {
    node_width: numOr(row.node_width, DEFAULT_PREVIEW.node_width),
    node_height: numOr(row.node_height, DEFAULT_PREVIEW.node_height),
    column_gap: numOr(row.column_gap, DEFAULT_PREVIEW.column_gap),
    row_gap: numOr(row.row_gap, DEFAULT_PREVIEW.row_gap),
    highway_lane: numOr(row.highway_lane, DEFAULT_PREVIEW.highway_lane),
  }
}

/** @param {Record<string, unknown>} row @param {string} sourceFile @param {Partial<ElementCatalog>} globals */
function normalizeMachine(row, sourceFile, globals) {
  const id = String(row.id ?? '').trim()
  if (!id) fail(`Machine missing id in ${sourceFile}.`)
  const inputSlots = int(row.input_slots, `machine ${id} input_slots`, 1)
  const outputSlots = int(row.output_slots, `machine ${id} output_slots`, 1)
  const color = requireHexColor(row.color, `machine ${id} color`)
  const decor = String(row.decor ?? '').trim()
  if (!decor) fail(`machine ${id}: decor is required (e.g. pipeline/combiner-2-decor.svg).`)
  return {
    id,
    name_pt: String(row.name_pt ?? id),
    input_slots: inputSlots,
    output_slots: outputSlots,
    coupled_dual_output: row.coupled_dual_output !== false,
    split_single_across_ports: row.split_single_across_ports !== false,
    color,
    decor,
    default_rate_per_minute: ratePerMinute(
      row.default_rate_per_minute ?? globals.defaultRatePerMinute,
      `machine ${id} default_rate_per_minute`,
    ),
  }
}

/** @param {Record<string, unknown>} row @param {string} sourceFile */
function normalizeChapter(row, sourceFile) {
  const id = Number(row.id)
  if (!Number.isInteger(id) || id < 1) fail(`Chapter id must be a positive integer in ${sourceFile}.`)
  const name = String(row.name_pt ?? '').trim()
  if (!name) fail(`Chapter ${id} missing name_pt.`)
  return {
    id,
    name_pt: name,
    summary_pt: String(row.summary_pt ?? '').trim(),
    max_new_bases: int(row.max_new_bases ?? 0, `chapter ${id} max_new_bases`, 0),
    required_multiplier: Number(row.required_multiplier ?? 1),
  }
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} sourceFile
 * @param {Partial<ElementCatalog>} globals
 */
function normalizeElement(row, sourceFile, globals) {
  const id = String(row.id ?? '').trim()
  if (!id) fail(`Element missing id in ${sourceFile}.`)
  const tier = Number(row.tier)
  if (!Number.isInteger(tier) || tier < 1 || tier > globals.maxTier) {
    fail(`Element ${id}: tier must be 1..${globals.maxTier}, got ${row.tier}`)
  }

  const coproductOf = row.coproduct_of == null ? null : String(row.coproduct_of).trim()
  const inputs = normalizeIdList(row.inputs, `Element ${id} inputs`)
  let outputs = normalizeIdList(row.outputs, `Element ${id} outputs`)
  let machine = row.machine == null ? null : String(row.machine).trim()

  if (coproductOf) {
    if (inputs.length > 0) fail(`Element ${id}: co-product must not list inputs.`)
    if (outputs.length > 0) fail(`Element ${id}: co-product must not list outputs.`)
    if (machine) fail(`Element ${id}: co-product must not list machine.`)
    outputs = [id]
  } else if (tier === 1) {
    if (inputs.length > 0) fail(`Element ${id}: tier 1 must not have inputs.`)
    if (outputs.length === 0) outputs = [id]
    if (machine) fail(`Element ${id}: bases must not list machine.`)
  } else {
    if (inputs.length !== 2 && inputs.length !== 3) {
      fail(`Element ${id}: expected 2 or 3 inputs, got ${inputs.length}.`)
    }
    if (new Set(inputs).size !== inputs.length) fail(`Element ${id}: inputs must be distinct.`)
    if (outputs.length === 0) outputs = [id]
    if (outputs.length > 2) fail(`Element ${id}: at most 2 outputs.`)
    if (!outputs.includes(id)) fail(`Element ${id}: outputs must include its own id.`)
    if (new Set(outputs).size !== outputs.length) fail(`Element ${id}: outputs must be distinct.`)
    if (!machine) fail(`Element ${id}: crafted element requires machine.`)
  }

  const fill = String(row.fill ?? row.color ?? '').trim()
  if (!fill) fail(`Element ${id}: fill (or color) is required.`)
  const stroke = String(row.stroke ?? globals.defaultStroke).trim()
  const glyph = String(row.glyph ?? `pipeline/elements/${id}.svg`).trim()
  const demandChapter = int(row.demand_chapter, `Element ${id} demand_chapter`, 1)

  return {
    id,
    name_pt: String(row.name_pt ?? id),
    tier,
    family: String(row.family ?? 'neutral').trim() || 'neutral',
    sort_key: Number(row.sort_key ?? tier * 100),
    fill,
    stroke,
    glyph,
    glyph_size_px: int(row.glyph_size_px ?? globals.defaultGlyphSizePx, `Element ${id} glyph_size_px`, 1),
    inputs,
    outputs,
    coproduct_of: coproductOf,
    machine,
    rate_per_minute:
      coproductOf || tier === 1
        ? null
        : row.rate_per_minute == null
          ? null
          : ratePerMinute(row.rate_per_minute, `Element ${id} rate_per_minute`),
    productivity:
      row.productivity == null && !coproductOf && tier > 1
        ? globals.defaultProductivity
        : row.productivity == null
          ? null
          : Number(row.productivity),
    demand_chapter: demandChapter,
    demand_required: int(
      row.demand_required ?? globals.defaultDemandRequired,
      `Element ${id} demand_required`,
      1,
    ),
    source_rate_per_minute:
      tier === 1 && !coproductOf
        ? row.source_rate_per_minute == null
          ? null
          : ratePerMinute(row.source_rate_per_minute, `Element ${id} source_rate_per_minute`)
        : null,
    source_spawn_chance_percent:
      tier === 1 && !coproductOf
        ? int(row.source_spawn_chance_percent ?? 0, `Element ${id} source_spawn_chance_percent`, 0)
        : null,
    sourceFile,
  }
}

/**
 * @param {Element} el
 * @param {Map<string, Element>} byId
 * @param {Map<string, MachineKind>} machinesById
 * @param {number} maxTier
 */
function validateElementLinks(el, byId, machinesById, maxTier) {
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

  if (el.machine) {
    const machine = machinesById.get(el.machine)
    if (!machine) fail(`Element ${el.id}: unknown machine "${el.machine}".`)
    if (machine.input_slots !== el.inputs.length) {
      fail(
        `Element ${el.id}: machine "${el.machine}" expects ${machine.input_slots} inputs, recipe has ${el.inputs.length}.`,
      )
    }
    if (el.outputs.length > machine.output_slots) {
      fail(
        `Element ${el.id}: machine "${el.machine}" has ${machine.output_slots} output slots, recipe has ${el.outputs.length}.`,
      )
    }
  }

  if (el.inputs.length > 0) {
    const expected = 1 + Math.max(...el.inputs.map((id) => byId.get(id).tier))
    if (el.tier !== expected) {
      fail(`Element ${el.id}: tier ${el.tier} does not match 1 + max(input tiers) = ${expected}.`)
    }
    if (el.tier > maxTier) fail(`Element ${el.id}: tier exceeds max_tier ${maxTier}.`)
  }
}

/** @param {Chapter[]} chapters @param {Map<string, Element>} byId */
function validateChapters(chapters, byId) {
  if (chapters.length === 0) fail('No [[chapters]] entries. Each element needs a demand chapter.')
  const byChapterId = new Map()
  for (const chapter of chapters) {
    if (byChapterId.has(chapter.id)) fail(`Duplicate chapter id ${chapter.id}.`)
    byChapterId.set(chapter.id, chapter)
  }
  const ordered = [...byChapterId.values()].sort((a, b) => a.id - b.id)
  ordered.forEach((chapter, index) => {
    if (chapter.id !== index + 1) fail(`Chapters must be contiguous from 1. Missing ${index + 1}.`)
  })

  for (const el of byId.values()) {
    if (!byChapterId.has(el.demand_chapter)) {
      fail(`Element ${el.id}: demand_chapter ${el.demand_chapter} is not a defined chapter.`)
    }
  }

  for (const el of byId.values()) {
    if (el.coproduct_of) {
      const primary = byId.get(el.coproduct_of)
      if (primary.demand_chapter !== el.demand_chapter) {
        fail(`Element ${el.id}: co-product chapter must match ${primary.id}.`)
      }
      continue
    }
    for (const inputId of el.inputs) {
      const input = byId.get(inputId)
      if (input.demand_chapter > el.demand_chapter) {
        fail(
          `Element ${el.id}: input "${inputId}" is demanded in chapter ${input.demand_chapter}, after chapter ${el.demand_chapter}.`,
        )
      }
    }
  }

  /** @type {Map<number, string[]>} */
  const newBases = new Map()
  for (const el of byId.values()) {
    if (el.tier !== 1) continue
    const list = newBases.get(el.demand_chapter) ?? []
    list.push(el.id)
    newBases.set(el.demand_chapter, list)
  }
  for (const [chapterId, ids] of newBases) {
    const limit = byChapterId.get(chapterId).max_new_bases
    if (ids.length > limit) {
      fail(
        `Chapter ${chapterId} introduces ${ids.length} bases (${ids.join(', ')}). max_new_bases is ${limit}.`,
      )
    }
  }

  return ordered
}

/** @param {string[]} starterIds @param {Map<string, Element>} byId */
function validateStarters(starterIds, byId) {
  if (starterIds.length === 0) fail('starter_source_ids must list at least one base element.')
  for (const id of starterIds) {
    const el = byId.get(id)
    if (!el) fail(`starter_source_ids: unknown element "${id}".`)
    if (el.tier !== 1 || el.coproduct_of) {
      fail(`starter_source_ids: "${id}" must be a tier-1 base.`)
    }
  }
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

/** @param {string} configDir */
function discoverTomlFiles(configDir) {
  /** @type {string[]} */
  const files = []
  const rootFile = join(configDir, 'elements.toml')
  if (existsSync(rootFile) && statSync(rootFile).isFile()) files.push(rootFile)
  const dir = join(configDir, 'elements')
  if (existsSync(dir) && statSync(dir).isDirectory()) collectTomlRecursive(dir, files)
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

/** @param {unknown} value */
function asArray(value) {
  return Array.isArray(value) ? value : []
}

/** @param {unknown} value @param {string} label */
function normalizeIdList(value, label) {
  if (value == null) return []
  if (!Array.isArray(value)) fail(`${label} must be an array, got ${typeof value}`)
  return value.map((v) => String(v).trim()).filter(Boolean)
}

/** @param {unknown} value @param {string} label @param {number} min */
function int(value, label, min) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min) fail(`${label} must be an integer >= ${min}, got ${value}`)
  return n
}

/** @param {unknown} value @param {string} label */
function ratePerMinute(value, label) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) fail(`${label} must be a positive number, got ${value}`)
  return n
}

/** @param {unknown} value @param {number} fallback */
function numOr(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** @param {unknown} value @param {string} label */
function requireHexColor(value, label) {
  const color = String(value ?? '').trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    fail(`${label} must be hex #RRGGBB, got ${JSON.stringify(value)}.`)
  }
  return color
}

/** @param {string} message */
function fail(message) {
  const error = new Error(`elements.toml: ${message}`)
  error.name = 'ElementCatalogError'
  throw error
}
