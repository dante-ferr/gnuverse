export type Direction = 'north' | 'east' | 'south' | 'west'

export type PipelineRules = {
  tickMs: number
  gridWidth: number
  gridHeight: number
  tileCap: number
  sourcePeriodTicks: number
  stabilityCapacity: number
  stabilityInitial: number
  stabilityWindowTicks: number
  stabilityRequiredDeliveries: number
  stabilityDrain: number
  stabilityRestore: number
  stabilityGraceTicks: number
  colorBackground: string
  colorGrid: string
  colorBelt: string
  colorPacket: string
  colorCore: string
  colorSource: string
  colorStability: string
  colorStabilityOk: string
}

export type BeltRecord = {
  id: string
  x: number
  y: number
  direction: Direction
  authorId: string
  authorNickname: string
  placedAt: number
}

export type PipelineFrame = {
  kind: 'pipeline'
  version: '0.1'
  seed: string
  width: number
  height: number
  tick: number
  crashed: boolean
  stability: number
  deliveries: number
  graceRemaining: number
  collaborators: { id: string; nickname: string }[]
  belts: BeltRecord[]
  packets: { id: string; x: number; y: number; shape: 'circle' }[]
  source: { id: string; x: number; y: number; direction: Direction }
  core: { id: string; x: number; y: number }
}

export function isPipelineFrame(value: unknown): value is PipelineFrame {
  return Boolean(value && typeof value === 'object' && (value as { kind?: string }).kind === 'pipeline')
}

export function pipelineRulesFrom(rules: Record<string, unknown> | null): PipelineRules | null {
  const pipeline = rules?.pipeline
  if (!pipeline || typeof pipeline !== 'object') return null
  return pipeline as PipelineRules
}
