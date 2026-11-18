/** Public login handle (apelido). Stored as Payload `username`. */
export const USERNAME_PATTERN = /^[\p{L}\p{N}_-]{3,32}$/u

export function normalizeUsername(value: string): string {
  return value.toLowerCase().trim()
}

/** Build a unique-enough default handle from a display name or e-mail local part. */
export function usernameFromIdentity(name: string, email: string): string {
  const local = email.split('@')[0] || ''
  const base = (name || local)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, 32)
  const padded = (base || 'admin').padEnd(3, '_').slice(0, 32)
  return USERNAME_PATTERN.test(padded) ? padded : `u_${padded}`.slice(0, 32)
}

export function isEmailIdentifier(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isUsernameIdentifier(value: string): boolean {
  return USERNAME_PATTERN.test(value)
}
