export type ReachSegment = {
  id: string
  ax: number
  ay: number
  bx: number
  by: number
}

function angleDelta(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

/** Direção do galho de volta para a origem (pai / chão). */
function backwardAngle(segment: ReachSegment): number | null {
  const dx = segment.ax - segment.bx
  const dy = segment.ay - segment.by
  if (dx * dx + dy * dy < 1e-6) return null
  return Math.atan2(dy, dx)
}

function rayCircle(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  radius: number,
): number | null {
  const lx = ox - cx
  const ly = oy - cy
  const b = lx * dx + ly * dy
  const c = lx * lx + ly * ly - radius * radius
  const disc = b * b - c
  if (disc < 0) return null
  const s = Math.sqrt(disc)
  const near = -b - s
  const far = -b + s
  if (near > 1e-3) return near
  if (far > 1e-3) return far
  return null
}

/** Primeira entrada do raio numa cápsula, ou null se o raio não a alcança pela frente. */
function rayEnterCapsule(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  segment: ReachSegment,
  radius: number,
): number | null {
  const hits: number[] = []
  const pushCircle = (cx: number, cy: number) => {
    const t = rayCircle(ox, oy, dx, dy, cx, cy, radius)
    if (t !== null) hits.push(t)
  }
  pushCircle(segment.ax, segment.ay)
  pushCircle(segment.bx, segment.by)
  const abx = segment.bx - segment.ax
  const aby = segment.by - segment.ay
  const abLen2 = abx * abx + aby * aby
  if (abLen2 > 1e-8) {
    const aox = ox - segment.ax
    const aoy = oy - segment.ay
    const cross = (x1: number, y1: number, x2: number, y2: number) => x1 * y2 - y1 * x2
    const c0 = cross(aox, aoy, abx, aby)
    const cD = cross(dx, dy, abx, aby)
    const a = cD * cD
    const b = 2 * c0 * cD
    const c = c0 * c0 - radius * radius * abLen2
    const disc = b * b - 4 * a * c
    if (disc >= 0 && a > 1e-10) {
      const s = Math.sqrt(disc)
      for (const t of [(-b - s) / (2 * a), (-b + s) / (2 * a)]) {
        if (t <= 1e-3) continue
        const px = ox + dx * t
        const py = oy + dy * t
        const u = ((px - segment.ax) * abx + (py - segment.ay) * aby) / abLen2
        if (u >= 0 && u <= 1) hits.push(t)
      }
    }
  }
  if (!hits.length) return null
  hits.sort((p, q) => p - q)
  return hits[0]!
}

/**
 * Distância alcançável a partir da âncora na direção `angle`.
 * O semicírculo de volta para a origem do galho clicado fica de fora.
 * Outros galhos cortam o alcance na superfície (a área atrás deles some).
 */
export function reachDistanceAtAngle(
  anchorX: number,
  anchorY: number,
  angle: number,
  radius: number,
  segments: readonly ReachSegment[],
  sourceId: string,
  halfWidth: number,
): number {
  const source = segments.find((segment) => segment.id === sourceId)
  if (source) {
    const back = backwardAngle(source)
    if (back !== null && angleDelta(angle, back) <= Math.PI / 2) return 0
  }
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  let limit = radius
  if (source) {
    const tipDist = Math.hypot(source.bx - anchorX, source.by - anchorY)
    if (tipDist > halfWidth) {
      const ux = (source.bx - anchorX) / tipDist
      const uy = (source.by - anchorY) / tipDist
      const ahead = halfWidth + 0.5
      const shaft: ReachSegment = {
        id: source.id,
        ax: anchorX + ux * ahead,
        ay: anchorY + uy * ahead,
        bx: source.bx,
        by: source.by,
      }
      const hit = rayEnterCapsule(anchorX, anchorY, dx, dy, shaft, halfWidth)
      if (hit !== null && hit < limit) limit = hit
    }
  }
  for (const segment of segments) {
    if (segment.id === sourceId) continue
    const hit = rayEnterCapsule(anchorX, anchorY, dx, dy, segment, halfWidth)
    if (hit !== null && hit < limit) limit = hit
  }
  return limit
}

export function reachBoundary(
  anchorX: number,
  anchorY: number,
  radius: number,
  segments: readonly ReachSegment[],
  sourceId: string,
  halfWidth: number,
  samples = 180,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  for (let i = 0; i < samples; i++) {
    const angle = -Math.PI + (i * 2 * Math.PI) / samples
    const distance = reachDistanceAtAngle(
      anchorX,
      anchorY,
      angle,
      radius,
      segments,
      sourceId,
      halfWidth,
    )
    points.push({
      x: anchorX + Math.cos(angle) * distance,
      y: anchorY + Math.sin(angle) * distance,
    })
  }
  return points
}
