/**
 * Darkens an `#RRGGBB` color by multiplying each channel by `(100 - percent) / 100`.
 * Used so machine decor ink stays a darker tone of that machine's body color.
 */
export function darkenHex(hex: string, percent: number): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!match) return hex
  const raw = match[1]!
  const factor = Math.max(0, Math.min(100, percent))
  const scale = (100 - factor) / 100
  const channel = (offset: number) => {
    const value = Math.round(parseInt(raw.slice(offset, offset + 2), 16) * scale)
    return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(2)}${channel(4)}`
}
