import type { PipelineRules } from '../rules.ts'

/** Shared stability for every demanded packet type. v0.1 tracks circles only. */
export class StabilityMeter {
  value: number
  private recent: number[]
  private rules: PipelineRules

  constructor(rules: PipelineRules, value = rules.stabilityInitial, recent: number[] = []) {
    this.rules = rules
    this.value = value
    this.recent = recent.slice(-rules.stabilityWindowTicks)
  }

  record(deliveries: number, graceRemaining: number) {
    if (graceRemaining > 0) return
    this.recent.push(deliveries)
    if (this.recent.length > this.rules.stabilityWindowTicks) this.recent.shift()
    const total = this.recent.reduce((sum, count) => sum + count, 0)
    if (total >= this.rules.stabilityRequiredDeliveries)
      this.value = Math.min(this.rules.stabilityCapacity, this.value + this.rules.stabilityRestore)
    else this.value = Math.max(0, this.value - this.rules.stabilityDrain)
  }

  snapshot() {
    return { value: this.value, recent: [...this.recent] }
  }
}
