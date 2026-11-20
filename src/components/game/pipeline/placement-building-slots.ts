import { CombinerMachine } from '../../../../game-server/pipeline/machines/combiner-machine.ts'
import { CoreMachine } from '../../../../game-server/pipeline/machines/core-machine.ts'
import { SourceMachine } from '../../../../game-server/pipeline/machines/source-machine.ts'
import { SplitterMachine } from '../../../../game-server/pipeline/machines/splitter-machine.ts'
import { TrashcanMachine } from '../../../../game-server/pipeline/machines/trashcan-machine.ts'
import { TunnelPortalMachine } from '../../../../game-server/pipeline/machines/tunnel-machine.ts'
import type { Machine } from '../../../../game-server/pipeline/machines/machine.ts'
import type { Direction } from '../../../../game-server/pipeline/geometry/direction.ts'
import type { BuildingFootprint } from '../../../../game-server/pipeline/world/edit/building-slots.ts'
import {
  buildingBodyKeySet,
  logisticContactBlocked,
  portsOverlapBuildings,
} from '../../../../game-server/pipeline/world/edit/building-slots.ts'
import type { PacketShape } from '../../../../game-server/pipeline/packets/packet.ts'
import type { PipelineFrame } from './model/frame.ts'

const PREVIEW_AUTHOR = { id: 'preview', nickname: 'preview' }

export function proposedBuildingPlacementBlocked(
  frame: PipelineFrame,
  proposedSlots: readonly {
    cell: { x: number; y: number }
    role: 'input' | 'output'
    travel: Direction
  }[],
  proposedFootprints: readonly BuildingFootprint[],
  proposedIsLogistic = false,
): boolean {
  return portsOverlapBuildings(proposedSlots, proposedFootprints, machinesFromFrame(frame), {
    proposedIsLogistic,
  })
}

export function proposedSplitterPlacementBlocked(
  frame: PipelineFrame,
  proposedSlots: readonly {
    cell: { x: number; y: number }
    role: 'input' | 'output'
    travel: Direction
  }[],
  proposedFootprints: readonly BuildingFootprint[],
): boolean {
  const machines = machinesFromFrame(frame)
  if (
    portsOverlapBuildings(proposedSlots, proposedFootprints, machines, {
      proposedIsLogistic: true,
    })
  ) {
    return true
  }
  return logisticContactBlocked(proposedSlots, proposedFootprints, machines, 'splitter') !== null
}

export function proposedTunnelPlacementBlocked(
  frame: PipelineFrame,
  proposedSlots: readonly {
    cell: { x: number; y: number }
    role: 'input' | 'output'
    travel: Direction
  }[],
  proposedFootprints: readonly BuildingFootprint[],
): boolean {
  const machines = machinesFromFrame(frame)
  return portsOverlapBuildings(proposedSlots, proposedFootprints, machines, {
    proposedIsLogistic: true,
  })
}

export function buildingBodyKeysFromFrame(frame: PipelineFrame): Set<string> {
  return buildingBodyKeySet(machinesFromFrame(frame))
}

export function splitterProbeSlots(
  x: number,
  y: number,
  facing: Direction,
): readonly { cell: { x: number; y: number } }[] {
  return new SplitterMachine('probe', { x, y }, facing, PREVIEW_AUTHOR).slots
}

export function trashcanProbeSlots(
  x: number,
  y: number,
  facing: Direction,
): readonly { cell: { x: number; y: number } }[] {
  return new TrashcanMachine('probe', { x, y }, facing).slots
}

export function combinerProbeSlots(
  machineId: 'combiner_2' | 'combiner_3',
  x: number,
  y: number,
  facing: Direction,
): readonly { cell: { x: number; y: number } }[] {
  return new CombinerMachine('probe', machineId, { x, y }, facing).slots
}

export function tunnelProbeSlots(
  entrance: { x: number; y: number },
  exit: { x: number; y: number },
  facing: Direction,
  gap: number,
): readonly { cell: { x: number; y: number } }[] {
  const entrancePortal = new TunnelPortalMachine(
    'probe:in',
    entrance,
    'entrance',
    'probe',
    facing,
    PREVIEW_AUTHOR,
    gap,
  )
  const exitPortal = new TunnelPortalMachine(
    'probe:out',
    exit,
    'exit',
    'probe',
    facing,
    PREVIEW_AUTHOR,
    0,
  )
  return [...entrancePortal.slots, ...exitPortal.slots]
}

export function machinesFromFrame(frame: PipelineFrame): Machine[] {
  const machines: Machine[] = []
  const cores = frame.cores?.length ? frame.cores : [frame.core]
  for (const core of cores) {
    machines.push(new CoreMachine(core.id, { x: core.x, y: core.y }))
  }
  const sources = frame.sources?.length
    ? frame.sources
    : [frame.source]
  for (const source of sources) {
    if (!source) continue
    const shape = ('role' in source && source.role ? source.role : source.shape) as PacketShape
    machines.push(
      new SourceMachine(
        source.id,
        { x: source.x, y: source.y },
        source.direction,
        shape,
        60,
      ),
    )
  }
  for (const combiner of frame.combiners ?? []) {
    machines.push(
      new CombinerMachine(
        combiner.id,
        combiner.machineId,
        { x: combiner.x, y: combiner.y },
        combiner.facing,
      ),
    )
  }
  for (const trashcan of frame.trashcans ?? []) {
    machines.push(
      new TrashcanMachine(
        trashcan.id,
        { x: trashcan.x, y: trashcan.y },
        trashcan.facing,
        { id: trashcan.authorId, nickname: trashcan.authorNickname },
      ),
    )
  }
  for (const splitter of frame.splitters ?? []) {
    machines.push(
      new SplitterMachine(
        splitter.id,
        { x: splitter.x, y: splitter.y },
        splitter.facing,
        { id: splitter.authorId, nickname: splitter.authorNickname },
      ),
    )
  }
  for (const portal of frame.tunnels ?? []) {
    const gap =
      portal.role === 'entrance' ? (portal.queue?.length ?? 0) : 0
    machines.push(
      new TunnelPortalMachine(
        portal.id,
        { x: portal.x, y: portal.y },
        portal.role,
        portal.pairId,
        portal.direction,
        { id: portal.authorId, nickname: portal.authorNickname },
        gap,
        portal.speed ?? 1,
      ),
    )
  }
  return machines
}
