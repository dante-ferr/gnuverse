import type { PipelineRules } from '../model/frame.ts'

/** How much machine body art to keep at the current camera zoom. */
export type MachineLod = 'full' | 'flat' | 'cores'

export type SceneLod = {
  /** Catalog glyphs on packets and orbit overlays when true; disks otherwise. */
  packetGlyphs: boolean
  /** Animated belt chevrons (tracks always draw). */
  beltChevrons: boolean
  machines: MachineLod
}

/**
 * Zoom bands from `pipeline.toml`:
 * - at/above `lodDetailMinZoom`: full art
 * - at/above `lodStructureMinZoom`: disks, no chevrons, flat machine fills + cores
 * - below that: disks, no chevrons, cores only (source/combiner glyphs still draw)
 */
export function sceneLod(zoom: number, rules: PipelineRules): SceneLod {
  const detail = rules.lodDetailMinZoom
  const structure = rules.lodStructureMinZoom
  if (zoom >= detail) {
    return { packetGlyphs: true, beltChevrons: true, machines: 'full' }
  }
  if (zoom >= structure) {
    return { packetGlyphs: false, beltChevrons: false, machines: 'flat' }
  }
  return { packetGlyphs: false, beltChevrons: false, machines: 'cores' }
}

export function sceneLodKey(lod: SceneLod): string {
  return `${lod.packetGlyphs ? 1 : 0}${lod.beltChevrons ? 1 : 0}${lod.machines[0]}`
}

/**
 * Scale for **machine** resource overlays (source orbit, combiner craft) after
 * translating to a world anchor. Belt packets always use world size (scale 1).
 *
 * Above `resourceGlyphWorldMinZoom`: screen-fixed at `resource_glyph_size_px`
 * (`1 / zoom`). Zooming in grows the machine under a fixed glyph so details stay
 * readable. Below that zoom: constant world size `size / threshold` so the glyph
 * shrinks with the map when zoomed out, continuous at the threshold (no jump).
 * No machine-footprint clamp — size may exceed the body when zoomed out.
 */
export function glyphSpaceScale(zoom: number, rules: PipelineRules): number {
  const z = zoom > 0 ? zoom : 1
  const t = rules.resourceGlyphWorldMinZoom
  if (!(t > 0)) return 1 / z
  if (z > t) return 1 / z
  return 1 / t
}
