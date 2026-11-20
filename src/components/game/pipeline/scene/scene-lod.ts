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
 * - below that: disks, no chevrons, cores only
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
