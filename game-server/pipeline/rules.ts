export type PipelineRules = {
  tickMs: number
  gridWidth: number
  gridHeight: number
  tileCap: number
  sourcePeriodTicks: number
  colorBackground: string
  colorGrid: string
  colorBelt: string
  colorPacket: string
  colorCore: string
  colorSource: string
  /** GNUverse accent; used in core decor details (must match core-decor.svg). */
  colorAccent: string
  /** SVG stroke width in artboard units (512 viewBox); keep in sync with public/pipeline/*.svg. */
  decorStrokeWidth: number
  machineClearanceMin: number
  coreClearanceExtra: number
}
