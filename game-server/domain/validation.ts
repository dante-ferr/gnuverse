export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
export function fail(status: number, message: string): never {
  throw new HttpError(status, message)
}
export const number = (
  value: unknown,
  min: number,
  max: number,
  label: string,
): number => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    fail(400, `${label} inválido.`)
  return value
}
export const integer = (
  value: unknown,
  min: number,
  max: number,
  label: string,
): number => {
  number(value, min, max, label)
  if (!Number.isInteger(value)) fail(400, `${label} inválido.`)
  return value as number
}
export const text = (
  value: unknown,
  min: number,
  max: number,
  label: string,
): string => {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, `${label} inválido.`)
  return value.trim()
}
export const mode = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback?: T,
): T => {
  value ??= fallback
  if (!allowed.includes(value as T)) fail(400, 'Modalidade inválida.')
  return value as T
}
