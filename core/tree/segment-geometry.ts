import type { TreeNodeLite } from './types.ts'

export type SegmentHit = {
  segmentId: string
  parentId: string
  t: number
  x: number
  y: number
}

export function segmentEndpoints(
  nodes: readonly TreeNodeLite[],
  childId: string,
): { ax: number; ay: number; bx: number; by: number } | null {
  const child = nodes.find((n) => n.id === childId && !n.broken)
  if (!child || child.parentId === null) return null
  const parent = nodes.find((n) => n.id === child.parentId && !n.broken)
  if (!parent) return null
  const origin = child.attach ?? parent
  return { ax: origin.x, ay: origin.y, bx: child.x, by: child.y }
}

export function projectOnSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): { t: number; x: number; y: number; dist: number } {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-6) {
    const dist = Math.hypot(px - ax, py - ay)
    return { t: 0, x: ax, y: ay, dist }
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const x = ax + t * dx
  const y = ay + t * dy
  const dist = Math.hypot(px - x, py - y)
  return { t, x, y, dist }
}

export function hitTestSegments(
  nodes: readonly TreeNodeLite[],
  px: number,
  py: number,
  padding: number,
): SegmentHit | null {
  let best: (SegmentHit & { dist: number }) | null = null
  for (const node of nodes) {
    if (node.broken || node.parentId === null) continue
    const ends = segmentEndpoints(nodes, node.id)
    if (!ends) continue
    const hit = projectOnSegment(ends.ax, ends.ay, ends.bx, ends.by, px, py)
    if (hit.dist <= padding && (!best || hit.dist < best.dist)) {
      best = {
        segmentId: node.id,
        parentId: node.parentId,
        t: hit.t,
        x: hit.x,
        y: hit.y,
        dist: hit.dist,
      }
    }
  }
  return best
}

/** Haste do broto: da superfície do terreno até a raiz. O id do segmento é o da raiz. */
export function hitTestSprout(
  root: TreeNodeLite,
  groundY: number,
  px: number,
  py: number,
  padding: number,
): SegmentHit | null {
  if (root.broken || root.parentId !== null) return null
  const hit = projectOnSegment(root.x, groundY, root.x, root.y, px, py)
  if (hit.dist > padding) return null
  return {
    segmentId: root.id,
    parentId: root.id,
    t: hit.t,
    x: hit.x,
    y: hit.y,
  }
}

/** Move a âncora para a ponta quando o clique cai dentro do raio dela. */
export function snapAnchorToTip(
  hit: SegmentHit,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  baseSegmentId: string | null,
  radius: number,
): SegmentHit {
  const tipDist = Math.hypot(hit.x - bx, hit.y - by)
  const baseDist = Math.hypot(hit.x - ax, hit.y - ay)
  if (tipDist <= radius && (baseSegmentId === null || tipDist <= baseDist)) {
    return { ...hit, x: bx, y: by, t: 1 }
  }
  if (baseSegmentId !== null && baseDist <= radius) {
    return {
      segmentId: baseSegmentId,
      parentId: baseSegmentId,
      t: 1,
      x: ax,
      y: ay,
    }
  }
  return hit
}

export function hitTestRoot(
  nodes: readonly TreeNodeLite[],
  px: number,
  py: number,
  radius: number,
): SegmentHit | null {
  const root = nodes.find((n) => n.parentId === null && !n.broken)
  if (!root) return null
  const dist = Math.hypot(px - root.x, py - root.y)
  if (dist > radius) return null
  return {
    segmentId: root.id,
    parentId: root.id,
    t: 0,
    x: root.x,
    y: root.y,
  }
}