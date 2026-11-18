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
  const bases = catalog.elements.filter((el) => el.inputs.length === 0)
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
  const summaryParts = [
    `T${output.tier}`,
    inputs.map((el) => el.name_pt).join(' + '),
    '→',
    output.name_pt,
  ]
  return `
<details class="recipe" data-tier="${output.tier}" data-id="${escapeAttr(output.id)}">
  <summary>
    <span class="badge">T${output.tier}</span>
    <span class="summary-title">${escapeHtml(summaryParts.slice(1).join(' '))}</span>
    <code>${escapeHtml(output.id)}</code>
  </summary>
  <div class="recipe-body">
    ${renderRecipeChart(inputs, output)}
    <dl class="meta">
      <div><dt>Entradas</dt><dd>${inputs
        .map((el) => `<code>${escapeHtml(el.id)}</code> (${escapeHtml(el.name_pt)}, T${el.tier})`)
        .join(' + ')}</dd></div>
      <div><dt>Saída</dt><dd><code>${escapeHtml(output.id)}</code> (${escapeHtml(output.name_pt)}, T${output.tier})</dd></div>
      <div><dt>Arquivo</dt><dd><code>${escapeHtml(basename(output.sourceFile))}</code></dd></div>
    </dl>
  </div>
</details>`
}

/**
 * @param {import('./load.mjs').Element[]} inputs
 * @param {import('./load.mjs').Element} output
 */
function renderRecipeChart(inputs, output) {
  const nodeW = 132
  const nodeH = 64
  const gap = 28
  const plusW = 24
  const arrowW = 40
  const padX = 16
  const padY = 20
  const nodes = [...inputs, output]
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
  slots.push({ kind: 'node', el: output, x, result: true })
  x += nodeW + padX

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
        <text x="${nodeW / 2}" y="28" text-anchor="middle" fill="${ink}" class="node-name">${escapeHtml(el.name_pt)}</text>
        <text x="${nodeW / 2}" y="48" text-anchor="middle" fill="${ink}" class="node-id">${escapeHtml(el.id)} · T${el.tier}</text>
      </g>`
    })
    .join('\n')

  return `
<figure class="chart">
  <svg viewBox="0 0 ${width} ${height}" width="100%" role="img"
    aria-label="${escapeAttr(inputs.map((e) => e.name_pt).join(' + ') + ' → ' + output.name_pt)}">
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
.chart {
  margin: 0 0 0.75rem;
  overflow-x: auto;
  background: #f3f6f7;
  border-radius: 10px;
  padding: 0.5rem;
}
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
