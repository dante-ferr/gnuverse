/** FNV-1a 32-bit hash for stable string seeds. */
function hashSeed(seed: string): number {
  let h = 2_166_136_261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 1_677_761_9)
  }
  return h >>> 0
}

/** Deterministic PRNG in [0, 1) from a string seed (mulberry32). */
export function createSeedRng(seed: string): () => number {
  let state = hashSeed(seed)
  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}