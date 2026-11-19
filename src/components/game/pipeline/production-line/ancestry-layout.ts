import type {
  ElementCatalogJson,
  ElementRecord,
} from '../../../../../game-server/pipeline/elements/index.ts'

/** Compact icon + label cell (Anno-style production tree). */
export const ICON_LAYOUT = {
  iconSize: 44,
  labelHeight: 20,
  nodeWidth: 76,
  /** Gap between column blocks (wider so direct arrows have room). */
  columnGap: 88,
  rowGap: 36,
  /** Space between primary output and its co-product. */
  siblingGap: 32,
  padX: 16,
  padTop: 12,
  padBottom: 16,
} as const

export type AncestryNode = {
  /** Unique instance key (element may repeat across columns). */
  key: string
  id: string
  namePt: string
  tier: number
  fill: string
  glyph: string
  x: number
  y: number
  w: number
  h: number
  iconSize: number
  isTarget: boolean
  /** True when this is a local copy for a later craft, not the primary placement. */
  isRepeat: boolean
}

export type AncestryEdge = {
  d: string
  /** Flow edges get an arrowhead; co-product links do not. */
  arrow: boolean
}

export type AncestryChartModel = {
  width: number
  height: number
  ariaLabel: string
  edges: AncestryEdge[]
  plusMarks: { x: number; y: number }[]
  nodes: AncestryNode[]
}

type ChartInstance = {
  key: string
  elementId: string
  col: number
  isPrimary: boolean
  isTarget: boolean
}

type ChartEdge = {
  from: string
  to: string
  kind: 'flow' | 'coproduct'
}

function nodeHeight(): number {
  return ICON_LAYOUT.iconSize + ICON_LAYOUT.labelHeight
}

function glyphUrl(el: ElementRecord): string {
  if (!el.glyph) return '/pipeline/resource-circle.svg'
  return el.glyph.startsWith('/') ? el.glyph : `/${el.glyph}`
}

function primaryKey(elementId: string): string {
  return `p:${elementId}`
}

function repeatKey(elementId: string, col: number): string {
  return `r:${elementId}@${col}`
}

/** Build a layered ancestry chart for one catalog element. */
export function buildAncestryChart(
  targetId: string,
  catalog: ElementCatalogJson,
): AncestryChartModel | null {
  const byId = indexById(catalog.elements)
  const target = resolveTarget(targetId, byId)
  if (!target) return null

  const ancestry = collectAncestry(target, byId)
  if (ancestry.size <= 1) {
    return buildSingleNodeChart(target)
  }

  const { instances, edges, columnCount } = buildInstancesAndEdges(ancestry, byId, target)
  const coproductOf = new Map<string, string>()
  for (const edge of edges) {
    if (edge.kind === 'coproduct') coproductOf.set(edge.to, edge.from)
  }

  const rowByKey = assignInstanceRows(instances, edges, columnCount, coproductOf)

  const {
    nodeWidth: nodeW,
    columnGap: colGap,
    rowGap,
    siblingGap,
    padX,
    padTop,
    padBottom,
    iconSize,
  } = ICON_LAYOUT
  const nodeH = nodeHeight()

  // Columns that host a dual output need room for primary + sibling side by side.
  const colContentWidth: number[] = Array.from({ length: columnCount }, () => Number(nodeW))
  for (const [sibKey, primaryKeyValue] of coproductOf) {
    const primary = instances.find((inst) => inst.key === primaryKeyValue)
    const sib = instances.find((inst) => inst.key === sibKey)
    if (!primary || !sib) continue
    const needed = nodeW + siblingGap + nodeW
    colContentWidth[primary.col] = Math.max(colContentWidth[primary.col]!, needed)
  }

  const colX: number[] = []
  let cursor: number = padX
  for (let col = 0; col < columnCount; col++) {
    colX[col] = cursor
    cursor += colContentWidth[col]! + (col < columnCount - 1 ? colGap : 0)
  }

  let maxRows = 0
  for (const row of rowByKey.values()) maxRows = Math.max(maxRows, row + 1)

  const posByKey = new Map<
    string,
    { x: number; y: number; cy: number; iconLeft: number; iconRight: number; iconTop: number }
  >()

  for (const inst of instances) {
    if (coproductOf.has(inst.key)) continue
    const row = rowByKey.get(inst.key) ?? 0
    const x = colX[inst.col]!
    const y = padTop + row * (nodeH + rowGap)
    posByKey.set(inst.key, {
      x,
      y,
      cy: y + iconSize / 2,
      iconLeft: x + (nodeW - iconSize) / 2,
      iconRight: x + (nodeW + iconSize) / 2,
      iconTop: y,
    })
  }

  for (const [sibKey, primaryKeyValue] of coproductOf) {
    const primaryPos = posByKey.get(primaryKeyValue)
    if (!primaryPos) continue
    const x = primaryPos.x + nodeW + siblingGap
    const y = primaryPos.y
    posByKey.set(sibKey, {
      x,
      y,
      cy: y + iconSize / 2,
      iconLeft: x + (nodeW - iconSize) / 2,
      iconRight: x + (nodeW + iconSize) / 2,
      iconTop: y,
    })
  }

  const { edges: drawnEdges, plusMarks } = buildDrawnEdges(edges, posByKey, iconSize)

  let maxRight: number = padX
  for (const pos of posByKey.values()) maxRight = Math.max(maxRight, pos.x + nodeW)
  const width = maxRight + padX
  const height = padTop + maxRows * nodeH + Math.max(0, maxRows - 1) * rowGap + padBottom

  const nodes: AncestryNode[] = instances.map((inst) => {
    const el = byId.get(inst.elementId)!
    const pos = posByKey.get(inst.key)!
    return {
      key: inst.key,
      id: inst.elementId,
      namePt: el.name_pt,
      tier: el.tier,
      fill: el.fill,
      glyph: glyphUrl(el),
      x: pos.x,
      y: pos.y,
      w: nodeW,
      h: nodeH,
      iconSize,
      isTarget: inst.isTarget,
      isRepeat: !inst.isPrimary,
    }
  })

  const bases = [...ancestry].filter((id) => byId.get(id)!.tier === 1)
  const targetOutputs = new Set(target.outputs.length > 0 ? target.outputs : [target.id])
  const outNames = [...targetOutputs].map((id) => byId.get(id)?.name_pt ?? id)
  const ariaLabel = `Caminho: bases ${bases.map((id) => byId.get(id)!.name_pt).join(', ')} até ${outNames.join(' + ')}`

  return { width, height, ariaLabel, edges: drawnEdges, plusMarks, nodes }
}

function buildDrawnEdges(
  edges: ChartEdge[],
  posByKey: Map<
    string,
    { x: number; y: number; cy: number; iconLeft: number; iconRight: number; iconTop: number }
  >,
  iconSize: number,
): { edges: AncestryEdge[]; plusMarks: { x: number; y: number }[] } {
  const flowEdges = edges.filter((edge) => edge.kind === 'flow')
  const coproductEdges = edges.filter((edge) => edge.kind === 'coproduct')
  const drawn: AncestryEdge[] = []
  const plusMarks: { x: number; y: number }[] = []

  const byTarget = new Map<string, ChartEdge[]>()
  for (const edge of flowEdges) {
    const list = byTarget.get(edge.to) ?? []
    list.push(edge)
    byTarget.set(edge.to, list)
  }

  for (const [, group] of byTarget) {
    // Stable order by source vertical position so stagger matches visual order.
    group.sort((a, b) => {
      const ay = posByKey.get(a.from)?.cy ?? 0
      const by = posByKey.get(b.from)?.cy ?? 0
      return ay - by
    })
    const n = group.length
    group.forEach((edge, index) => {
      const from = posByKey.get(edge.from)
      const to = posByKey.get(edge.to)
      if (!from || !to) return
      const x1 = from.iconRight
      const y1 = from.cy
      const x2 = to.iconLeft
      const y2 =
        n === 1
          ? to.cy
          : to.iconTop + iconSize * (0.18 + (0.64 * index) / Math.max(1, n - 1))
      // Short horizontal approach so arrowheads stay upright and don't share one tip.
      const approach = Math.min(18, Math.max(10, (x2 - x1) * 0.22))
      const xApproach = x2 - approach
      drawn.push({
        d: `M ${x1} ${y1} L ${xApproach} ${y2} L ${x2} ${y2}`,
        arrow: true,
      })
    })
  }

  for (const edge of coproductEdges) {
    const from = posByKey.get(edge.from)
    const to = posByKey.get(edge.to)
    if (!from || !to) continue
    const y = from.cy
    const x1 = from.iconRight
    const x2 = to.iconLeft
    drawn.push({
      d: `M ${x1} ${y} L ${x2} ${y}`,
      arrow: false,
    })
    plusMarks.push({ x: (x1 + x2) / 2, y })
  }

  return { edges: drawn, plusMarks }
}

/**
 * Place each element once at its native tier. When a craft needs an input from
 * a non-adjacent column, repeat that input in the previous column and only draw
 * short edges.
 */
function buildInstancesAndEdges(
  ancestry: Set<string>,
  byId: Map<string, ElementRecord>,
  target: ElementRecord,
): { instances: ChartInstance[]; edges: ChartEdge[]; columnCount: number } {
  const tiers = [...new Set([...ancestry].map((id) => byId.get(id)!.tier))].sort((a, b) => a - b)
  const colByTier = new Map(tiers.map((tier, index) => [tier, index]))
  const targetOutputs = new Set(target.outputs.length > 0 ? target.outputs : [target.id])

  const instances: ChartInstance[] = []
  const byKey = new Map<string, ChartInstance>()
  const primaryByElement = new Map<string, ChartInstance>()

  function addInstance(inst: ChartInstance) {
    if (byKey.has(inst.key)) return byKey.get(inst.key)!
    byKey.set(inst.key, inst)
    instances.push(inst)
    if (inst.isPrimary) primaryByElement.set(inst.elementId, inst)
    return inst
  }

  for (const id of ancestry) {
    const el = byId.get(id)!
    const col = colByTier.get(el.tier) ?? 0
    addInstance({
      key: primaryKey(id),
      elementId: id,
      col,
      isPrimary: true,
      isTarget: targetOutputs.has(id),
    })
  }

  const edges: ChartEdge[] = []
  const edgeSet = new Set<string>()

  function addEdge(from: string, to: string, kind: ChartEdge['kind']) {
    const token = `${kind}:${from}->${to}`
    if (edgeSet.has(token)) return
    edgeSet.add(token)
    edges.push({ from, to, kind })
  }

  const crafted = [...ancestry]
    .map((id) => byId.get(id)!)
    .filter((el) => el.inputs.length > 0)
    .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id))

  for (const el of crafted) {
    const outIds = el.outputs.filter((id) => ancestry.has(id))
    const primaryOutId = outIds.includes(el.id) ? el.id : outIds[0]
    if (!primaryOutId) continue
    const outInst = primaryByElement.get(primaryOutId)
    if (!outInst) continue

    for (const inputId of el.inputs) {
      if (!ancestry.has(inputId)) continue
      const inputPrimary = primaryByElement.get(inputId)
      if (!inputPrimary) continue

      let fromInst = inputPrimary
      if (inputPrimary.col < outInst.col - 1) {
        const prevCol = outInst.col - 1
        fromInst = addInstance({
          key: repeatKey(inputId, prevCol),
          elementId: inputId,
          col: prevCol,
          isPrimary: false,
          isTarget: false,
        })
      } else if (inputPrimary.col !== outInst.col - 1) {
        continue
      }

      addEdge(fromInst.key, outInst.key, 'flow')
    }

    for (const outId of outIds) {
      if (outId === primaryOutId) continue
      const sib = primaryByElement.get(outId)
      if (!sib) continue
      addEdge(outInst.key, sib.key, 'coproduct')
    }
  }

  return pruneOrphanInstances(instances, edges)
}

/**
 * Drop nodes with no edges (e.g. a native-tier primary that only appears as a
 * later-column repeat). Compact column indices if a column becomes empty.
 */
function pruneOrphanInstances(
  instances: ChartInstance[],
  edges: ChartEdge[],
): { instances: ChartInstance[]; edges: ChartEdge[]; columnCount: number } {
  const connected = new Set<string>()
  for (const edge of edges) {
    connected.add(edge.from)
    connected.add(edge.to)
  }

  const kept = instances.filter((inst) => connected.has(inst.key) || inst.isTarget)
  const usedCols = [...new Set(kept.map((inst) => inst.col))].sort((a, b) => a - b)
  const remap = new Map(usedCols.map((col, index) => [col, index]))
  for (const inst of kept) {
    inst.col = remap.get(inst.col) ?? 0
  }

  return {
    instances: kept,
    edges,
    columnCount: usedCols.length,
  }
}

function assignInstanceRows(
  instances: ChartInstance[],
  edges: ChartEdge[],
  columnCount: number,
  coproductOf: Map<string, string>,
): Map<string, number> {
  const rowByKey = new Map<string, number>()
  const columns: string[][] = Array.from({ length: columnCount }, () => [])
  for (const inst of instances) {
    if (coproductOf.has(inst.key)) continue
    columns[inst.col]!.push(inst.key)
  }

  const outsByFrom = new Map<string, string[]>()
  const insByTo = new Map<string, string[]>()
  for (const edge of edges) {
    if (edge.kind === 'coproduct') continue
    const outs = outsByFrom.get(edge.from) ?? []
    outs.push(edge.to)
    outsByFrom.set(edge.from, outs)
    const ins = insByTo.get(edge.to) ?? []
    ins.push(edge.from)
    insByTo.set(edge.to, ins)
  }

  const median = (values: number[]) => {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
  }

  const byKey = new Map(instances.map((inst) => [inst.key, inst]))

  for (let pass = 0; pass < 2; pass++) {
    for (let col = 0; col < columnCount; col++) {
      const keys = columns[col]!
      const scored = keys.map((key) => {
        const refs: number[] = []
        for (const from of insByTo.get(key) ?? []) {
          if (rowByKey.has(from)) refs.push(rowByKey.get(from)!)
        }
        for (const to of outsByFrom.get(key) ?? []) {
          if (rowByKey.has(to)) refs.push(rowByKey.get(to)!)
        }
        const inst = byKey.get(key)!
        const fallback = inst.elementId.charCodeAt(0) + (inst.isPrimary ? 0 : 0.25)
        return { key, score: refs.length ? median(refs) : fallback }
      })
      scored.sort((a, b) => a.score - b.score || a.key.localeCompare(b.key))
      scored.forEach((item, row) => rowByKey.set(item.key, row))
    }

    for (let col = columnCount - 2; col >= 0; col--) {
      const keys = columns[col]!
      const scored = keys.map((key) => {
        const childRows: number[] = []
        for (const to of outsByFrom.get(key) ?? []) {
          if (rowByKey.has(to)) childRows.push(rowByKey.get(to)!)
        }
        return {
          key,
          score: childRows.length ? median(childRows) : rowByKey.get(key)!,
        }
      })
      scored.sort((a, b) => a.score - b.score || a.key.localeCompare(b.key))
      scored.forEach((item, row) => rowByKey.set(item.key, row))
    }
  }

  for (const [sibKey, primaryKeyValue] of coproductOf) {
    rowByKey.set(sibKey, rowByKey.get(primaryKeyValue) ?? 0)
  }

  return rowByKey
}

function buildSingleNodeChart(target: ElementRecord): AncestryChartModel {
  const { nodeWidth: nodeW, padX, padTop, padBottom, iconSize } = ICON_LAYOUT
  const nodeH = nodeHeight()
  return {
    width: padX * 2 + nodeW,
    height: padTop + nodeH + padBottom,
    ariaLabel: `${target.name_pt} (fonte)`,
    edges: [],
    plusMarks: [],
    nodes: [
      {
        key: primaryKey(target.id),
        id: target.id,
        namePt: target.name_pt,
        tier: target.tier,
        fill: target.fill,
        glyph: glyphUrl(target),
        x: padX,
        y: padTop,
        w: nodeW,
        h: nodeH,
        iconSize,
        isTarget: true,
        isRepeat: false,
      },
    ],
  }
}

function resolveTarget(
  targetId: string,
  byId: Map<string, ElementRecord>,
): ElementRecord | null {
  const direct = byId.get(targetId)
  if (!direct) return null
  if (direct.coproduct_of) return byId.get(direct.coproduct_of) ?? direct
  return direct
}

function indexById(elements: ElementRecord[]): Map<string, ElementRecord> {
  const map = new Map<string, ElementRecord>()
  for (const el of elements) map.set(el.id, el)
  return map
}

function collectAncestry(
  target: ElementRecord,
  byId: Map<string, ElementRecord>,
): Set<string> {
  const nodes = new Set<string>()
  const recipe = target.coproduct_of ? byId.get(target.coproduct_of) ?? target : target

  function walk(id: string) {
    if (nodes.has(id)) return
    nodes.add(id)
    const el = byId.get(id)
    if (!el) return
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
