/**
 * Render an ElementCatalog as a self-contained HTML page.
 * One collapsible SVG chart per recipe — no Mermaid.
 */

import {
  ICON_LAYOUT,
  buildAncestryChart,
} from '../../src/components/game/pipeline/production-line/ancestry-layout.ts'
import { catalogToJson } from './load.mjs'

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
        .map((el) => renderRecipeDetails(el, catalog))
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

  const starters = new Set(catalog.starterSourceIds)
  const baseList = bases
    .map(
      (el) => `
    <li class="base" style="--swatch:${escapeAttr(el.fill)}">
      <span class="swatch" aria-hidden="true"></span>
      <strong>${escapeHtml(el.name_pt)}</strong>
      <code>${escapeHtml(el.id)}</code>
      <span class="muted">T${el.tier} · cap. ${el.demand_chapter}${
        starters.has(el.id) ? ' · starter' : ''
      } · spawn ${el.source_spawn_chance_percent ?? 0}%</span>
    </li>`,
    )
    .join('\n')

  const sourceList = catalog.sources
    .map((path) => `<li><code>${escapeHtml(displayPath(path, rootLabel))}</code></li>`)
    .join('\n')
  const progression = renderProgression(catalog)

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
      tier máximo ${catalog.maxTier} ·
      ${catalog.chapters.length} capítulos de demanda ·
      starters: ${catalog.starterSourceIds.map(escapeHtml).join(', ')}.
      O núcleo começa só com o capítulo 1.
      ${
        catalog.retainPriorDemands
          ? 'Capítulos anteriores continuam ativos.'
          : 'Capítulos anteriores são substituídos.'
      }
      Gerado a partir dos TOML em <code>${escapeHtml(rootLabel)}</code>.
    </p>
    <div class="toolbar">
      <button type="button" id="expand-all">Abrir todas as receitas</button>
      <button type="button" id="collapse-all">Fechar todas as receitas</button>
      <button type="button" id="reload">Recarregar</button>
    </div>
  </header>

  ${progression}

  <section class="panel">
    <h2>Fontes TOML</h2>
    <ul class="sources">${sourceList}</ul>
  </section>

  <section class="panel">
    <h2>Bases (tier 1)</h2>
    <p class="chart-caption">Cada base entra no capítulo indicado. O jogo não pede as seis no começo.</p>
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
/**
 * @param {import('./load.mjs').ElementCatalog} catalog
 */
function renderProgression(catalog) {
  const cards = catalog.chapters
    .map((chapter) => {
      const added = catalog.elements
        .filter((el) => el.demand_chapter === chapter.id)
        .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id))
      const newBases = added.filter((el) => el.tier === 1)
      const items = added
        .map((el) => {
          const kind = el.tier === 1 ? 'base nova' : el.coproduct_of ? '2ª saída' : `T${el.tier}`
          const recipe = el.coproduct_of
            ? `sai com ${escapeHtml(catalog.byId.get(el.coproduct_of).name_pt)}`
            : el.inputs.length
              ? escapeHtml(el.inputs.map((id) => catalog.byId.get(id).name_pt).join(' + '))
              : 'fonte'
          return `<li class="demand" style="--swatch:${escapeAttr(el.fill)}">
            <span class="swatch" aria-hidden="true"></span>
            <span class="demand-name">${escapeHtml(el.name_pt)}</span>
            <span class="badge">${escapeHtml(kind)}</span>
            <span class="muted">${recipe}</span>
          </li>`
        })
        .join('\n')
      const limit = chapter.max_new_bases
      const baseNote =
        newBases.length === 0
          ? `Nenhuma base nova (máx. ${limit}) — só fórmulas de fontes que já estão no jogo.`
          : `Base nova: ${newBases.map((el) => escapeHtml(el.name_pt)).join(', ')} (máx. ${limit}).`
      return `<article class="chapter" id="chapter-${chapter.id}">
        <header class="chapter-head">
          <p class="eyebrow">Capítulo ${chapter.id}</p>
          <h3>${escapeHtml(chapter.name_pt)}</h3>
          <p>${escapeHtml(chapter.summary_pt)}</p>
          <p class="chapter-rule">${baseNote} ${added.length} demanda${added.length === 1 ? '' : 's'} nova${added.length === 1 ? '' : 's'}.</p>
        </header>
        <ul class="demands">${items}</ul>
      </article>`
    })
    .join('\n')

  return `<section class="panel progression">
    <h2>Quando o núcleo pede cada elemento</h2>
    <p class="lede">
      O capítulo 1 é o começo da partida. Cada capítulo seguinte soma demandas
      ${catalog.retainPriorDemands ? 'e mantém as anteriores' : 'e substitui as anteriores'}.
      Uma fórmula só entra quando todos os ingredientes já foram pedidos antes
      (ou no mesmo capítulo). O limite de bases novas por capítulo vem de
      <code>max_new_bases</code> no TOML.
    </p>
    <div class="chapters">${cards}</div>
  </section>`
}

function formatCraftRate(output, catalog) {
  let rate = output.rate_per_minute
  if (rate == null && output.machine) {
    const machine = catalog.machinesById.get(output.machine)
    rate = machine?.default_rate_per_minute ?? catalog.defaultRatePerMinute
  }
  if (rate == null) return '—'
  return `${rate} peças/min`
}

function renderRecipeDetails(output, catalog) {
  const byId = catalog.byId
  const inputs = output.inputs.map((id) => byId.get(id))
  const outputs = output.outputs.map((id) => byId.get(id))
  const outLabel = outputs.map((el) => el.name_pt).join(' + ')
  const machine = output.machine ? catalog.machinesById.get(output.machine) : null
  return `
<details class="recipe" data-tier="${output.tier}" data-chapter="${output.demand_chapter}" data-id="${escapeAttr(output.id)}">
  <summary>
    <span class="badge">T${output.tier}</span>
    <span class="badge">Cap. ${output.demand_chapter}</span>
    <span class="summary-title">${escapeHtml(inputs.map((el) => el.name_pt).join(' + '))} → ${escapeHtml(outLabel)}</span>
    <code>${escapeHtml(output.outputs.join(', '))}</code>
  </summary>
  <div class="recipe-body">
    <p class="chart-caption">Caminho desde as bases até <strong>${escapeHtml(outLabel)}</strong></p>
    ${renderPathChart(output, catalog)}
    <p class="chart-caption chart-caption--direct">Combinação direta desta receita</p>
    ${renderDirectIconChart(inputs, outputs, output.id)}
    <dl class="meta">
      <div><dt>Entradas</dt><dd>${inputs
        .map((el) => `<code>${escapeHtml(el.id)}</code> (${escapeHtml(el.name_pt)}, T${el.tier})`)
        .join(' + ')}</dd></div>
      <div><dt>Capítulo</dt><dd>${output.demand_chapter}</dd></div>
      <div><dt>Máquina</dt><dd>${
        machine
          ? `<span class="swatch" style="background:${escapeAttr(machine.color)}" aria-hidden="true"></span> ${escapeHtml(machine.name_pt)} (<code>${escapeHtml(machine.id)}</code>) <code class="muted">${escapeHtml(machine.decor)}</code>`
          : '—'
      }</dd></div>
      <div><dt>Craft</dt><dd>${formatCraftRate(output, catalog)}</dd></div>
      <div><dt>Saídas</dt><dd>${outputs
        .map((el) => `<code>${escapeHtml(el.id)}</code> (${escapeHtml(el.name_pt)}, T${el.tier})`)
        .join(' + ')}</dd></div>
      <div><dt>Arquivo</dt><dd><code>${escapeHtml(basename(output.sourceFile))}</code></dd></div>
    </dl>
  </div>
</details>`
}

/**
 * Full ancestry chart (shared layout with the in-room overlay).
 *
 * @param {import('./load.mjs').Element} target
 * @param {import('./load.mjs').ElementCatalog} catalog
 */
function renderPathChart(target, catalog) {
  const chart = buildAncestryChart(target.id, catalogToJson(catalog))
  if (!chart) return ''
  return renderAncestryChartHtml(chart, target.id)
}

/**
 * @param {import('../../src/components/game/pipeline/production-line/ancestry-layout.ts').AncestryChartModel} chart
 * @param {string} chartId
 */
function renderAncestryChartHtml(chart, chartId) {
  const markerId = `arrow-${chartMarkerId(chartId)}`
  const edgeShapes = chart.edges
    .map(
      (edge) =>
        `<path class="chart-edge" fill="none" d="${edge.d}"${
          edge.arrow ? ` marker-end="url(#${markerId})"` : ''
        } />`,
    )
    .join('\n')
  const plusShapes = chart.plusMarks
    .map(
      (mark) =>
        `<text x="${mark.x}" y="${mark.y + 4}" class="chart-op" text-anchor="middle">+</text>`,
    )
    .join('\n')
  const nodes = chart.nodes.map((node) => renderChartIconNode(node)).join('\n')

  return `
<figure class="chart chart--icons" style="width:${chart.width}px;height:${chart.height}px" aria-label="${escapeAttr(chart.ariaLabel)}">
  <svg class="chart-edges" width="${chart.width}" height="${chart.height}" aria-hidden="true">
    <defs>
      <marker id="${markerId}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0 0 L7 3.5 L0 7 Z" class="chart-arrow-head" />
      </marker>
    </defs>
    ${edgeShapes}
    ${plusShapes}
  </svg>
  ${nodes}
</figure>`
}

/**
 * @param {import('../../src/components/game/pipeline/production-line/ancestry-layout.ts').AncestryNode} node
 */
function renderChartIconNode(node) {
  const classes = [
    'icon-node',
    node.isTarget ? 'icon-node--target' : '',
    node.isRepeat ? 'icon-node--repeat' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const glyph = escapeAttr(node.glyph)
  return `
  <div class="${classes}" style="left:${node.x}px;top:${node.y}px;width:${node.w}px">
    <span class="icon-glyph" style="width:${node.iconSize}px;height:${node.iconSize}px;background-color:${escapeAttr(node.fill)};mask-image:url(${glyph});-webkit-mask-image:url(${glyph})" aria-hidden="true"></span>
    <span class="icon-label">${escapeHtml(node.namePt)}</span>
  </div>`
}

/**
 * @param {import('./load.mjs').Element} el
 * @param {number} left
 * @param {number} top
 * @param {{ target?: boolean }} [opts]
 */
function renderElementIconNode(el, left, top, opts = {}) {
  const { nodeWidth: nodeW, iconSize } = ICON_LAYOUT
  const glyph = glyphUrlForElement(el)
  const classes = ['icon-node', opts.target ? 'icon-node--target' : ''].filter(Boolean).join(' ')
  return `
  <div class="${classes}" style="left:${left}px;top:${top}px;width:${nodeW}px">
    <span class="icon-glyph" style="width:${iconSize}px;height:${iconSize}px;background-color:${escapeAttr(el.fill)};mask-image:url(${escapeAttr(glyph)});-webkit-mask-image:url(${escapeAttr(glyph)})" aria-hidden="true"></span>
    <span class="icon-label">${escapeHtml(el.name_pt)}</span>
  </div>`
}

/** @param {import('./load.mjs').Element} el */
function glyphUrlForElement(el) {
  if (!el.glyph) return '/pipeline/resource-circle.svg'
  return el.glyph.startsWith('/') ? el.glyph : `/${el.glyph}`
}

/**
 * One-step recipe row (inputs → outputs) with icon nodes.
 *
 * @param {import('./load.mjs').Element[]} inputs
 * @param {import('./load.mjs').Element[]} outputs
 * @param {string} chartId
 */
function renderDirectIconChart(inputs, outputs, chartId) {
  const { nodeWidth: nodeW, iconSize, labelHeight } = ICON_LAYOUT
  const nodeH = iconSize + labelHeight
  const padX = 16
  const padY = 12
  const slotGap = 24
  const plusW = 18
  const arrowW = 40
  const markerId = `arrow-direct-${chartMarkerId(chartId)}`

  /** @type {{ kind: 'plus' | 'arrow', x: number, w?: number }[]} */
  const decorators = []
  /** @type {{ el: import('./load.mjs').Element, x: number, target: boolean }[]} */
  const placed = []
  let x = padX

  for (let i = 0; i < inputs.length; i++) {
    if (i > 0) {
      decorators.push({ kind: 'plus', x: x + plusW / 2 })
      x += plusW + slotGap / 2
    }
    placed.push({ el: inputs[i], x, target: false })
    x += nodeW + slotGap / 2
  }
  const arrowX = x
  decorators.push({ kind: 'arrow', x: arrowX, w: arrowW })
  x += arrowW + slotGap / 2

  for (let i = 0; i < outputs.length; i++) {
    if (i > 0) {
      decorators.push({ kind: 'plus', x: x + plusW / 2 })
      x += plusW + slotGap / 2
    }
    placed.push({ el: outputs[i], x, target: true })
    x += nodeW + (i < outputs.length - 1 ? slotGap / 2 : padX)
  }

  const width = x
  const height = padY * 2 + nodeH
  const iconCy = padY + iconSize / 2

  const svgDecor = decorators
    .map((slot) => {
      if (slot.kind === 'plus') {
        return `<text x="${slot.x}" y="${iconCy + 5}" class="chart-op" text-anchor="middle">+</text>`
      }
      const ax = slot.x
      const aw = slot.w ?? arrowW
      return `
      <line x1="${ax}" y1="${iconCy}" x2="${ax + aw - 10}" y2="${iconCy}" class="chart-edge chart-edge--line" />
      <path d="M ${ax + aw} ${iconCy} L ${ax + aw - 9} ${iconCy - 5} L ${ax + aw - 9} ${iconCy + 5} Z" class="chart-arrow-head chart-arrow-head--solid" />`
    })
    .join('\n')

  const nodes = placed.map((slot) => renderElementIconNode(slot.el, slot.x, padY, { target: slot.target })).join('\n')
  const aria = `${inputs.map((e) => e.name_pt).join(' + ')} → ${outputs.map((e) => e.name_pt).join(' + ')}`

  return `
<figure class="chart chart--icons chart--direct" style="width:${width}px;height:${height}px" aria-label="${escapeAttr(aria)}">
  <svg class="chart-edges" width="${width}" height="${height}" aria-hidden="true">
    <defs>
      <marker id="${markerId}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0 0 L7 3.5 L0 7 Z" class="chart-arrow-head" />
      </marker>
    </defs>
    ${svgDecor}
  </svg>
  ${nodes}
</figure>`
}

/** @param {string} id */
function chartMarkerId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_')
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
  --accent: #143a38;
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
.panel, .tier, .chapter {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
  max-width: 960px;
}
.progression { max-width: 960px; }
.chapters { display: grid; gap: 0.75rem; }
.chapter { margin-bottom: 0; }
.chapter-head h3 { margin: 0.15rem 0 0.35rem; font-size: 1.2rem; }
.chapter-head p { margin: 0.2rem 0; color: var(--muted); }
.chapter-rule { font-size: 0.88rem; }
.demands { list-style: none; margin: 0.75rem 0 0; padding: 0; display: grid; gap: 0.4rem; }
.demand {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0.4rem 0.55rem;
}
.demand .swatch {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 999px;
  background: var(--swatch);
  border: 2px solid #0a1014;
}
.demand-name { font-weight: 650; }
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
  max-width: 100%;
}
.chart--icons {
  position: relative;
  margin-left: 0;
  margin-right: auto;
}
.chart-edges {
  position: absolute;
  inset: 0;
  display: block;
  pointer-events: none;
  overflow: visible;
}
.chart-edge {
  stroke: var(--muted);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.chart-edge--line {
  stroke-width: 2;
}
.chart-arrow-head {
  fill: var(--muted);
}
.chart-arrow-head--solid {
  stroke: none;
}
.chart-op {
  fill: var(--ink);
  font-size: 14px;
  font-weight: 700;
  pointer-events: none;
}
.icon-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  z-index: 1;
}
.icon-node--target .icon-glyph {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 4px;
}
.icon-node--repeat {
  opacity: 0.92;
}
.icon-glyph {
  display: block;
  flex: none;
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
}
.icon-label {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
  color: var(--ink);
}
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
