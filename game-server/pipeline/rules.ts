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
