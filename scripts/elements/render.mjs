/**
 * Render an ElementCatalog as a self-contained HTML page.
 * One collapsible SVG chart per recipe — no Mermaid.
 */

/**
 * @param {import('./load.mjs').ElementCatalog} catalog
 * @param {{ rootLabel?: string }} [options]
 */
export function renderElementsPage(catalog, options = {}) {
  const rootLabel = options.rootLabel ?? 'game-server/config'
  const bases = catalog.elements.filter((el) => el.tier === 1 && !el.coproduct_of)
  const byTier = groupRecipesByTier(catalog)

  const recipeSections = byTier
    .map(([tier, recipes]) => {
      const cards = recipes
        .map((el) => renderRecipeDetails(el, catalog.byId))
        .join('\n')
      return `
<section class="tier" data-tier="${tier}">
  <header class="tier-head">
    <h2>Tier ${tier}</h2>
    <p>${recipes.length} receita${recipes.length === 1 ? '' : 's'}</p>
    <div class="tier-actions">
      <button type="button" data-expand-tier="${tier}">Abrir todas</button>
      <button type="button" data-collapse-tier="${tier}">Fechar todas</button>
    </div>
  </header>
  <div class="tier-recipes">
${cards}
  </div>
</section>`
    })
    .join('\n')

  const baseList = bases
    .map(
      (el) => `
    <li class="base" style="--swatch:${escapeAttr(el.color)}">
      <span class="swatch" aria-hidden="true"></span>
      <strong>${escapeHtml(el.name_pt)}</strong>
      <code>${escapeHtml(el.id)}</code>
      <span class="muted">T${el.tier}</span>
    </li>`,
    )
    .join('\n')

  const sourceList = catalog.sources
    .map((path) => `<li><code>${escapeHtml(displayPath(path, rootLabel))}</code></li>`)
    .join('\n')

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Open Pipeline — receitas de elementos</title>
  <style>
${PAGE_CSS}
  </style>
</head>
<body>
  <header class="page-head">
    <p class="eyebrow">Open Pipeline</p>
    <h1>Receitas de elementos</h1>
    <p class="lede">
      ${catalog.elements.length} elementos ·
      ${catalog.recipes.length} receitas ·
      tier máximo ${catalog.maxTier}.
      Gerado automaticamente a partir dos TOML em <code>${escapeHtml(rootLabel)}</code>.
    </p>
    <div class="toolbar">
      <button type="button" id="expand-all">Abrir todas as receitas</button>
      <button type="button" id="collapse-all">Fechar todas as receitas</button>
      <button type="button" id="reload">Recarregar</button>
    </div>
  </header>

  <section class="panel">
    <h2>Fontes TOML</h2>
    <ul class="sources">${sourceList}</ul>
  </section>

  <section class="panel">
    <h2>Bases (tier 1)</h2>
    <ul class="bases">${baseList}</ul>
  </section>

${recipeSections}

  <script>
${PAGE_JS}
  </script>
</body>
</html>
`
}

/**
 * @param {import('./load.mjs').ElementCatalog} catalog
 * @returns {[number, import('./load.mjs').Element[]][]}
 */
function groupRecipesByTier(catalog) {
  /** @type {Map<number, import('./load.mjs').Element[]>} */
  const map = new Map()
  for (const el of catalog.recipes) {
    const list = map.get(el.tier) ?? []
    list.push(el)
    map.set(el.tier, list)
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0])
}

/**
 * @param {import('./load.mjs').Element} output
 * @param {Map<string, import('./load.mjs').Element>} byId
 */
function renderRecipeDetails(output, byId) {
  const inputs = output.inputs.map((id) => byId.get(id))
  const outputs = output.outputs.map((id) => byId.get(id))
  const outLabel = outputs.map((el) => el.name_pt).join(' + ')
  return `
<details class="recipe" data-tier="${output.tier}" data-id="${escapeAttr(output.id)}">
  <summary>
    <span class="badge">T${output.tier}</span>
    <span class="summary-title">${escapeHtml(inputs.map((el) => el.name_pt).join(' + '))} → ${escapeHtml(outLabel)}</span>
    <code>${escapeHtml(output.outputs.join(', '))}</code>
  </summary>
  <div class="recipe-body">
    <p class="chart-caption">Caminho desde as bases até <strong>${escapeHtml(outLabel)}</strong></p>
    ${renderPathChart(output, byId)}
    <p class="chart-caption chart-caption--direct">Combinação direta desta receita</p>
    ${renderRecipeChart(inputs, outputs)}
    <dl class="meta">
      <div><dt>Entradas</dt><dd>${inputs
        .map((el) => `<code>${escapeHtml(el.id)}</code> (${escapeHtml(el.name_pt)}, T${el.tier})`)
        .join(' + ')}</dd></div>
      <div><dt>Saídas</dt><dd>${outputs
        .map((el) => `<code>${escapeHtml(el.id)}</code> (${escapeHtml(el.name_pt)}, T${el.tier})`)
        .join(' + ')}</dd></div>
      <div><dt>Arquivo</dt><dd><code>${escapeHtml(basename(output.sourceFile))}</code></dd></div>
    </dl>
  </div>
</details>`
}

/**
 * Layered ancestry chart with orthogonal edges routed only in column gaps
 * (never through node balloons).
 *
 * @param {import('./load.mjs').Element} target
 * @param {Map<string, import('./load.mjs').Element>} byId
 */
function renderPathChart(target, byId) {
  const ancestry = collectAncestry(target, byId)
  if (ancestry.size <= 1) {
    return renderRecipeChart([], [target])
  }

  const nodeW = 104
  const nodeH = 52
  const colGap = 72
  const rowGap = 18
  const padX = 24
  const padTop = 36
  const padBottom = 28
  const highwayLane = 16

  const tierColumns = layoutAncestryColumns(ancestry, byId)
  const rowById = assignAncestryRows(tierColumns, byId, ancestry)
  /** @type {Map<string, { x: number, y: number, w: number, h: number, col: number, row: number }>} */
  const posById = new Map()

  let maxRows = 0
  for (const id of ancestry) maxRows = Math.max(maxRows, (rowById.get(id) ?? 0) + 1)

  for (let colIndex = 0; colIndex < tierColumns.length; colIndex++) {
    const col = tierColumns[colIndex]
    for (const id of col.ids) {
      const row = rowById.get(id) ?? 0
      posById.set(id, {
        x: padX + colIndex * (nodeW + colGap),
        y: padTop + row * (nodeH + rowGap),
        w: nodeW,
        h: nodeH,
        col: colIndex,
        row,
      })
    }
  }

  const contentBottom = padTop + maxRows * nodeH + Math.max(0, maxRows - 1) * rowGap
  const edges = buildOrthogonalEdges(target, ancestry, byId, posById, {
    colGap,
    highwayLane,
    contentBottom,
  })

  const highwayExtra = edges.maxHighway * highwayLane
  const width = padX * 2 + tierColumns.length * nodeW + (tierColumns.length - 1) * colGap
  const height = contentBottom + padBottom + highwayExtra
  const yOffset = highwayExtra

  const nodeShapes = [...ancestry]
    .sort((a, b) => byId.get(a).tier - byId.get(b).tier || a.localeCompare(b))
    .map((id) => {
      const el = byId.get(id)
      const pos = posById.get(id)
      const ink = contrastInk(el.color)
      const isTarget = target.outputs.includes(id)
      return `
      <g transform="translate(${pos.x}, ${pos.y + yOffset})" data-id="${escapeAttr(id)}">
        <rect width="${nodeW}" height="${nodeH}" rx="10" ry="10"
          fill="${escapeAttr(el.color)}" stroke="#0a1014" stroke-width="${isTarget ? 4 : 3}"
          class="${isTarget ? 'node result' : 'node'}" />
        <text x="${nodeW / 2}" y="22" text-anchor="middle" fill="${ink}" class="node-name">${escapeHtml(el.name_pt)}</text>
        <text x="${nodeW / 2}" y="40" text-anchor="middle" fill="${ink}" class="node-id">${escapeHtml(el.id)} · T${el.tier}</text>
      </g>`
    })
    .join('\n')

  const tierLabels = tierColumns
    .map((col, i) => {
      const x = padX + i * (nodeW + colGap) + nodeW / 2
      return `<text x="${x}" y="${14 + yOffset}" text-anchor="middle" class="tier-label">T${col.tier}</text>`
    })
    .join('\n')

  const edgeShapes = edges.paths
    .map((d) => `<path class="path-edge" fill="none" stroke="#0a1014" stroke-width="2.25" d="${d}" />`)
    .join('\n')
  const plusMarks = edges.pluses
    .map(
      (p) =>
        `<text x="${p.x}" y="${p.y + yOffset + 5}" class="op" text-anchor="middle">+</text>`,
    )
    .join('\n')

  const bases = [...ancestry].filter((id) => byId.get(id).tier === 1)
  const aria = `Caminho: bases ${bases.map((id) => byId.get(id).name_pt).join(', ')} até ${target.outputs.map((id) => byId.get(id).name_pt).join(' + ')}`

  return `
<figure class="chart chart--path">
  <svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${escapeAttr(aria)}">
    ${tierLabels}
    <g transform="translate(0, ${yOffset})">${edgeShapes}</g>
    ${plusMarks}
    ${nodeShapes}
  </svg>
</figure>`
}

/**
 * @param {import('./load.mjs').Element} target
 * @param {Set<string>} ancestry
 * @param {Map<string, import('./load.mjs').Element>} byId
 * @param {Map<string, { x: number, y: number, w: number, h: number, col: number, row: number }>} posById
 * @param {{ colGap: number, highwayLane: number, contentBottom: number }} opts
 */
function buildOrthogonalEdges(target, ancestry, byId, posById, opts) {
  /** @type {string[]} */
  const paths = []
  /** @type {{ x: number, y: number }[]} */
  const pluses = []
  let maxHighway = 0
  /** @type {Map<string, number>} */
  const trackCounters = new Map()

  const crafted = [...ancestry]
    .map((id) => byId.get(id))
    .filter((el) => el.inputs.length > 0)

  for (const el of crafted) {
    const outIds = el.outputs.filter((id) => ancestry.has(id))
    const primaryOut = outIds.includes(el.id) ? el.id : outIds[0]
    const outPos = posById.get(primaryOut)
    if (!outPos) continue

    const inputCenters = el.inputs
      .filter((inputId) => ancestry.has(inputId))
      .map((inputId) => {
        const inp = posById.get(inputId)
        return { id: inputId, x: inp.x + inp.w, y: inp.y + inp.h / 2, col: inp.col }
      })

    const mergeX = outPos.x - opts.colGap / 2
    const outY = outPos.y + outPos.h / 2
    const outLeft = outPos.x

    if (inputCenters.length > 1) {
      const midY =
        inputCenters.reduce((s, c) => s + c.y, 0) / inputCenters.length
      pluses.push({ x: mergeX, y: midY })
    }

    for (const center of inputCenters) {
      const span = outPos.col - center.col
      if (span <= 1) {
        const trackKey = `${center.col}->${outPos.col}`
        const track = trackCounters.get(trackKey) ?? 0
        trackCounters.set(trackKey, track + 1)
        const bend = mergeX - 8 + (track % 3) * 6 - 6
        paths.push(
          `M ${center.x} ${center.y} L ${bend} ${center.y} L ${bend} ${outY} L ${outLeft} ${outY}`,
        )
      } else {
        maxHighway += 1
        const lane = maxHighway
        const highwayY = -lane * opts.highwayLane
        const leaveX = center.x + 10
        const enterX = outLeft - 10
        paths.push(
          `M ${center.x} ${center.y} L ${leaveX} ${center.y} L ${leaveX} ${highwayY} L ${enterX} ${highwayY} L ${enterX} ${outY} L ${outLeft} ${outY}`,
        )
      }
    }

    // Fan from primary output box to sibling co-products in the same column.
    for (const outId of outIds) {
      if (outId === primaryOut) continue
      const sib = posById.get(outId)
      if (!sib) continue
      const fromY = outPos.y + outPos.h
      const toY = sib.y
      const midX = outPos.x + outPos.w / 2
      paths.push(
        `M ${midX} ${fromY} L ${midX} ${(fromY + toY) / 2} L ${sib.x + sib.w / 2} ${(fromY + toY) / 2} L ${sib.x + sib.w / 2} ${toY}`,
      )
    }
  }

  return { paths, pluses, maxHighway }
}

/**
 * @param {import('./load.mjs').Element} target
 * @param {Map<string, import('./load.mjs').Element>} byId
 * @returns {Set<string>}
 */
function collectAncestry(target, byId) {
  const nodes = new Set()
  const recipe = target.coproduct_of ? byId.get(target.coproduct_of) : target

  /** @param {string} id */
  function walk(id) {
    if (nodes.has(id)) return
    nodes.add(id)
    const el = byId.get(id)
    if (el.coproduct_of) {
      walk(el.coproduct_of)
      return
    }
    for (const inputId of el.inputs) walk(inputId)
    for (const outputId of el.outputs) nodes.add(outputId)
  }

  walk(recipe.id)
  for (const outputId of recipe.outputs) nodes.add(outputId)
  return nodes
}

/**
 * @param {Set<string>} ancestry
 * @param {Map<string, import('./load.mjs').Element>} byId
 * @returns {{ tier: number, ids: string[] }[]}
 */
function layoutAncestryColumns(ancestry, byId) {
  /** @type {Map<number, string[]>} */
  const byTier = new Map()
  for (const id of ancestry) {
    const tier = byId.get(id).tier
    const list = byTier.get(tier) ?? []
    list.push(id)
    byTier.set(tier, list)
  }
  return [...byTier.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tier, ids]) => ({ tier, ids: [...ids].sort() }))
}

/**
 * Barycenter heuristic + reverse sweep to reduce crossings.
 *
 * @param {{ tier: number, ids: string[] }[]} tierColumns
 * @param {Map<string, import('./load.mjs').Element>} byId
 * @param {Set<string>} ancestry
 * @returns {Map<string, number>}
 */
function assignAncestryRows(tierColumns, byId, ancestry) {
  /** @type {Map<string, number>} */
  const rowById = new Map()

  const median = (values) => {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }

  for (let pass = 0; pass < 2; pass++) {
    for (const col of tierColumns) {
      const scored = col.ids.map((id) => {
        const el = byId.get(id)
        /** @type {number[]} */
        const refs = []
        if (el.inputs.length) {
          for (const inputId of el.inputs) {
            if (ancestry.has(inputId) && rowById.has(inputId)) refs.push(rowById.get(inputId))
          }
        }
        if (el.coproduct_of && rowById.has(el.coproduct_of)) {
          refs.push(rowById.get(el.coproduct_of) + 0.5)
        }
        for (const other of ancestry) {
          const o = byId.get(other)
          if (o.outputs.includes(id) && o.id !== id && rowById.has(o.id)) {
            refs.push(rowById.get(o.id) + 0.45)
          }
        }
        return { id, score: refs.length ? median(refs) : id.charCodeAt(0) }
      })
      scored.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
      scored.forEach((item, row) => rowById.set(item.id, row))
    }

    // Reverse sweep: pull parents toward children.
    for (let i = tierColumns.length - 2; i >= 0; i--) {
      const col = tierColumns[i]
      const scored = col.ids.map((id) => {
        /** @type {number[]} */
        const childRows = []
        for (const other of ancestry) {
          const o = byId.get(other)
          if (o.inputs.includes(id) && rowById.has(other)) childRows.push(rowById.get(other))
        }
        return { id, score: childRows.length ? median(childRows) : rowById.get(id) }
      })
      scored.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
      scored.forEach((item, row) => rowById.set(item.id, row))
    }
  }

  return rowById
}

/**
 * @param {import('./load.mjs').Element[]} inputs
 * @param {import('./load.mjs').Element[]} outputs
 */
function renderRecipeChart(inputs, outputs) {
  const nodeW = 120
  const nodeH = 58
  const gap = 22
  const plusW = 22
  const arrowW = 36
  const padX = 16
  const padY = 18
  const slots = []
  let x = padX

  for (let i = 0; i < inputs.length; i++) {
    if (i > 0) {
      slots.push({ kind: 'plus', x })
      x += plusW + gap / 2
    }
    slots.push({ kind: 'node', el: inputs[i], x })
    x += nodeW + gap / 2
  }
  slots.push({ kind: 'arrow', x })
  x += arrowW + gap / 2
  for (let i = 0; i < outputs.length; i++) {
    if (i > 0) {
      slots.push({ kind: 'plus', x })
      x += plusW + gap / 2
    }
    slots.push({ kind: 'node', el: outputs[i], x, result: true })
    x += nodeW + (i < outputs.length - 1 ? gap / 2 : padX)
  }

  const width = x
  const height = nodeH + padY * 2
  const cy = height / 2

  const shapes = slots
    .map((slot) => {
      if (slot.kind === 'plus') {
        return `<text x="${slot.x + plusW / 2}" y="${cy + 6}" class="op" text-anchor="middle">+</text>`
      }
      if (slot.kind === 'arrow') {
        const ax = slot.x
        return `
        <line x1="${ax}" y1="${cy}" x2="${ax + arrowW - 8}" y2="${cy}" class="arrow-line" />
        <polygon points="${ax + arrowW},${cy} ${ax + arrowW - 10},${cy - 6} ${ax + arrowW - 10},${cy + 6}" class="arrow-head" />`
      }
      const el = slot.el
      const ink = contrastInk(el.color)
      return `
      <g transform="translate(${slot.x}, ${padY})">
        <rect width="${nodeW}" height="${nodeH}" rx="12" ry="12"
          fill="${escapeAttr(el.color)}" stroke="#0a1014" stroke-width="3"
          class="${slot.result ? 'node result' : 'node'}" />
        <text x="${nodeW / 2}" y="24" text-anchor="middle" fill="${ink}" class="node-name">${escapeHtml(el.name_pt)}</text>
        <text x="${nodeW / 2}" y="42" text-anchor="middle" fill="${ink}" class="node-id">${escapeHtml(el.id)} · T${el.tier}</text>
      </g>`
    })
    .join('\n')

  return `
<figure class="chart chart--direct">
  <svg viewBox="0 0 ${width} ${height}" width="100%" role="img"
    aria-label="${escapeAttr(inputs.map((e) => e.name_pt).join(' + ') + ' → ' + outputs.map((e) => e.name_pt).join(' + '))}">
    ${shapes}
  </svg>
</figure>`
}

/** @param {string} hex */
function contrastInk(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#0a1014'
  const n = Number.parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.55 ? '#0a1014' : '#f4f7f8'
}

/** @param {string} absolute @param {string} rootLabel */
function displayPath(absolute, rootLabel) {
  const marker = '/game-server/config/'
  const idx = absolute.replace(/\\/g, '/').lastIndexOf(marker)
  if (idx >= 0) return absolute.slice(idx + 1)
  return `${rootLabel}/${basename(absolute)}`
}

/** @param {string} path */
function basename(path) {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}

/** @param {string} value */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** @param {string} value */
function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", '&#39;')
}

const PAGE_CSS = `
:root {
  color-scheme: light;
  --bg: #eef3f5;
  --panel: #ffffff;
  --ink: #0a1014;
  --muted: #5a6b73;
  --line: #c5d0d6;
  --accent: #1a4542;
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 1.5rem clamp(1rem, 3vw, 2.5rem) 3rem;
  background:
    radial-gradient(circle at top left, #d7ece8 0, transparent 42%),
    linear-gradient(180deg, #f7fbfc, var(--bg));
  color: var(--ink);
}
.page-head { max-width: 960px; margin-bottom: 1.5rem; }
.eyebrow {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
  color: var(--accent);
  font-weight: 700;
}
h1 { margin: 0 0 0.5rem; font-size: clamp(1.6rem, 3vw, 2.2rem); }
h2 { margin: 0; font-size: 1.1rem; }
.lede { margin: 0 0 1rem; color: var(--muted); max-width: 62ch; }
.toolbar, .tier-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
button {
  appearance: none;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--ink);
  border-radius: 8px;
  padding: 0.45rem 0.75rem;
  font: inherit;
  cursor: pointer;
}
button:hover { border-color: var(--accent); }
.panel, .tier {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
  max-width: 960px;
}
.sources, .bases { list-style: none; margin: 0.75rem 0 0; padding: 0; }
.sources li { margin: 0.25rem 0; }
.bases {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.6rem;
}
.base {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 0.55rem;
  row-gap: 0.1rem;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.55rem 0.65rem;
}
.base .swatch {
  grid-row: 1 / span 2;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 999px;
  background: var(--swatch);
  border: 2px solid #0a1014;
}
.base code, .base .muted { grid-column: 2; font-size: 0.8rem; color: var(--muted); }
.base .muted { justify-self: start; }
.tier-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem 1rem;
  margin-bottom: 0.85rem;
}
.tier-head p { margin: 0; color: var(--muted); }
.tier-actions { margin-left: auto; }
.recipe {
  border: 1px solid var(--line);
  border-radius: 10px;
  margin: 0.55rem 0;
  background: #fbfcfd;
}
.recipe summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
  padding: 0.7rem 0.85rem;
}
.recipe summary::-webkit-details-marker { display: none; }
.recipe summary::before {
  content: "▸";
  color: var(--muted);
  width: 1rem;
}
.recipe[open] summary::before { content: "▾"; }
.badge {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.15rem 0.45rem;
  color: var(--muted);
}
.summary-title { font-weight: 600; }
.recipe-body { padding: 0 0.85rem 0.9rem; }
.chart-caption {
  margin: 0 0 0.4rem;
  font-size: 0.88rem;
  color: var(--muted);
}
.chart-caption--direct { margin-top: 0.85rem; }
.chart {
  margin: 0 0 0.75rem;
  overflow-x: auto;
  background: #f3f6f7;
  border-radius: 10px;
  padding: 0.5rem;
}
.chart--path { min-height: 7rem; }
.tier-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  fill: var(--muted);
  text-transform: uppercase;
}
.path-edge { opacity: 0.9; }
.node-name { font-size: 14px; font-weight: 700; }
.node-id { font-size: 11px; opacity: 0.85; }
.op { font-size: 22px; font-weight: 700; fill: var(--muted); }
.arrow-line { stroke: #0a1014; stroke-width: 3; }
.arrow-head { fill: #0a1014; }
.meta { margin: 0; display: grid; gap: 0.35rem; }
.meta div { display: grid; grid-template-columns: 6rem 1fr; gap: 0.5rem; }
.meta dt { margin: 0; color: var(--muted); font-size: 0.85rem; }
.meta dd { margin: 0; }
code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 0.86em; }
`

const PAGE_JS = `
const recipes = () => [...document.querySelectorAll("details.recipe")];
const inTier = (tier) => recipes().filter((el) => el.dataset.tier === String(tier));

document.getElementById("expand-all")?.addEventListener("click", () => {
  for (const el of recipes()) el.open = true;
});
document.getElementById("collapse-all")?.addEventListener("click", () => {
  for (const el of recipes()) el.open = false;
});
document.getElementById("reload")?.addEventListener("click", () => {
  location.reload();
});
for (const button of document.querySelectorAll("[data-expand-tier]")) {
  button.addEventListener("click", () => {
    for (const el of inTier(button.getAttribute("data-expand-tier"))) el.open = true;
  });
}
for (const button of document.querySelectorAll("[data-collapse-tier]")) {
  button.addEventListener("click", () => {
    for (const el of inTier(button.getAttribute("data-collapse-tier"))) el.open = false;
  });
}
`
