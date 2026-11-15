export type TerrainConfig = {
  worldWidth: number
  terrainSamples: number
  terrainAmplitude: number
  terrainMaxSlope: number
  terrainBaseY: number
}

/** Deterministic hash from seed string and index. */
function hashSeed(seed: string, index: number): number {
  let h = 2166136261 ^ index
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

function smoothNoise(seed: string, t: number): number {
  const i = Math.floor(t)
  const f = t - i
  const a = hashSeed(seed, i)
  const b = hashSeed(seed, i + 1)
  const blend = f * f * (3 - 2 * f)
  return a * (1 - blend) + b * blend
}

/** Surface y (Matter y-down) at world x; higher hills use smaller y. */
export function terrainSurfaceY(
  x: number,
  seed: string,
  config: TerrainConfig,
): number {
  const { worldWidth, terrainAmplitude, terrainBaseY } = config
  const t = (x / worldWidth) * config.terrainSamples
  const n =
    smoothNoise(seed, t * 0.35) * 0.55 +
    smoothNoise(seed + ':b', t * 0.9) * 0.35 +
    hashSeed(seed, Math.floor(t)) * 0.1
  const rise = n * terrainAmplitude
  return terrainBaseY - rise
}

export function terrainPolyline(
  seed: string,
  config: TerrainConfig,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  const step = config.worldWidth / (config.terrainSamples - 1)
  let prevY = terrainSurfaceY(0, seed, config)
  for (let i = 0; i < config.terrainSamples; i++) {
    let x = i * step
    let y = terrainSurfaceY(x, seed, config)
    if (i > 0) {
      const maxDrop = step * config.terrainMaxSlope
      const minY = prevY - maxDrop
      const maxY = prevY + maxDrop
      y = Math.max(minY, Math.min(maxY, y))
    }
    points.push({ x, y })
    prevY = y
  }
  return points
}

export function lowestTerrainY(
  seed: string,
  config: TerrainConfig,
): number {
  const line = terrainPolyline(seed, config)
  return Math.max(...line.map((p) => p.y))
}

export function rootAnchorY(
  seed: string,
  rootX: number,
  clearanceAboveTerrain: number,
  config: TerrainConfig,
): number {
  return terrainSurfaceY(rootX, seed, config) - clearanceAboveTerrain
}