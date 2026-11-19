import type { Cell } from '../../geometry/cell.ts'
import { ahead, opposite, type Direction } from '../../geometry/direction.ts'
import { CoreMachine } from '../../machines/core-machine.ts'
import { SourceMachine } from '../../machines/source-machine.ts'
import { defaultSourcePeriodTicks, sourcePeriodTicksForElement } from '../../elements/rate.ts'
import type { PipelineRules } from '../../rules.ts'
import { collectLayoutCandidates } from '../placement/approach.ts'
import { PlacementField } from '../placement/field.ts'
import type { PlacedSource } from '../types.ts'
import {
  previewCoords,
  starterChunkCoord,
  visibleAabb,
  type ChunkCoord,
} from './coords.ts'
import type { MatchLayout } from './match-layout.ts'

function chunkLocalOrigin(coord: ChunkCoord, originChunk: ChunkCoord, chunkSize: number): Cell {
  return {
    x: (coord.cx - originChunk.cx) * chunkSize,
    y: (coord.cy - originChunk.cy) * chunkSize,
  }
}

/** Sandbox grid: 3×3 owned chunks, three cores, all tier-1 element sources. */
export function layoutSandboxFromSeed(rules: PipelineRules, seed: string): MatchLayout & {
  coreOrigins: Cell[]
} {
  const chunkSize = rules.chunkSize
  const extent = rules.mapChunkExtent
  const starter = starterChunkCoord(extent)
  const ownedChunks: ChunkCoord[] = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const coord = { cx: starter.cx + dx, cy: starter.cy + dy }
      if (coord.cx >= 0 && coord.cy >= 0 && coord.cx < extent && coord.cy < extent) {
        ownedChunks.push(coord)
      }
    }
  }
  const previewChunks = previewCoords(ownedChunks, extent)
  const visible = [...ownedChunks, ...previewChunks]
  const { originChunk, width, height } = visibleAabb(visible, chunkSize)

  const center = chunkLocalOrigin(starter, originChunk, chunkSize)
  const inset = Math.floor((chunkSize - CoreMachine.size) / 2)
  const coreOrigins: Cell[] = [
    { x: center.x + inset, y: center.y + inset },
    { x: center.x + chunkSize + inset, y: center.y + inset },
    { x: center.x + inset, y: center.y + chunkSize + inset },
  ]
  const coreOrigin = coreOrigins[0]!

  const sources = layoutSandboxTierOneSources(rules, seed, coreOrigins, width, height)

  return {
    originChunk,
    width,
    height,
    ownedChunks,
    previewChunks,
    coreOrigin,
    coreOrigins,
    sources,
  }
}

function layoutSandboxTierOneSources(
  rules: PipelineRules,
  seed: string,
  coreOrigins: Cell[],
  gridWidth: number,
  gridHeight: number,
): PlacedSource[] {
  const tierOne = rules.elements.elements
    .filter((el) => el.tier === 1)
    .sort((a, b) => a.sort_key - b.sort_key)

  const occupied = coreOrigins.map((origin) => ({ kind: 'core' as const, origin }))
  const field = new PlacementField(rules, gridWidth, gridHeight, occupied)

  const allCandidates: { sourceOrigin: Cell; sourceDirection: Direction }[] = []
  for (const coreOrigin of coreOrigins) {
    const coreDepths = field.coreDepthsAt(coreOrigin)
    allCandidates.push(...collectLayoutCandidates(rules, coreOrigin, coreDepths, gridWidth, gridHeight))
  }
  const seen = new Set<string>()
  const candidates = allCandidates.filter((c) => {
    const key = `${c.sourceOrigin.x},${c.sourceOrigin.y},${c.sourceDirection}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  void seed
  const placed: PlacedSource[] = []
  const busy = new PlacementField(rules, gridWidth, gridHeight, occupied)

  for (const el of tierOne) {
    let picked: (typeof candidates)[0] | null = null
    for (const candidate of candidates) {
      const probe = new SourceMachine(
        `source-${el.id}`,
        candidate.sourceOrigin,
        candidate.sourceDirection,
        el.id,
        sourcePeriodTicksForElement(rules.elements, rules.tickMs, el),
      )
      if (busy.sourceOverlapsOccupied(probe)) continue
      picked = candidate
      break
    }
    if (!picked) {
      throw new Error(`Sandbox layout cannot place tier-1 source "${el.id}" with clearance`)
    }
    placed.push({
      id: `source-${el.id}`,
      origin: picked.sourceOrigin,
      direction: picked.sourceDirection,
      shape: el.id,
      role: el.id,
      sourcePeriodTicks: sourcePeriodTicksForElement(rules.elements, rules.tickMs, el),
    })
    busy.addOccupied({
      kind: 'source',
      origin: picked.sourceOrigin,
      direction: picked.sourceDirection,
    })
    const usedKey = `${picked.sourceOrigin.x},${picked.sourceOrigin.y},${picked.sourceDirection}`
    for (let i = candidates.length - 1; i >= 0; i--) {
      const c = candidates[i]!
      if (`${c.sourceOrigin.x},${c.sourceOrigin.y},${c.sourceDirection}` === usedKey) {
        candidates.splice(i, 1)
      }
    }
  }

  return placed
}

export function sandboxMachinesFromLayout(
  rules: PipelineRules,
  layout: MatchLayout & { coreOrigins?: Cell[] },
) {
  const coreOrigins = layout.coreOrigins ?? [layout.coreOrigin]
  const cores = coreOrigins.map((origin, index) => new CoreMachine(`core-${index}`, origin))
  const roles: Record<string, PlacedSource['role']> = {}
  const sources = layout.sources.map((spec) => {
    roles[spec.id] = spec.role
    return new SourceMachine(
      spec.id,
      spec.origin,
      spec.direction,
      spec.shape,
      spec.sourcePeriodTicks ?? defaultSourcePeriodTicks(rules.elements, rules.tickMs),
    )
  })
  return { cores, sources, roles }
}

/** Belt approach cell one step outside a combiner input (for tests). */
export function approachCellForInput(
  combiner: { inputSlots(): { cell: Cell; travel: Direction }[] },
  inputIndex = 0,
) {
  const slot = combiner.inputSlots()[inputIndex]
  if (!slot) throw new Error('Missing combiner input slot')
  return ahead(slot.cell.x, slot.cell.y, opposite(slot.travel))
}