const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 10

/** In-process limiter for public signup. Enough for a single CMS instance. */
const attempts = new Map<string, number[]>()

export function registrationClientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  return headers.get('x-real-ip')?.trim() || 'unknown'
}

export function consumeRegistrationAttempt(
  key: string,
  now = Date.now(),
  limits: { windowMs?: number; maxAttempts?: number } = {},
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const windowMs = limits.windowMs ?? WINDOW_MS
  const maxAttempts = limits.maxAttempts ?? MAX_ATTEMPTS
  const recent = (attempts.get(key) ?? []).filter((time) => time > now - windowMs)
  if (recent.length >= maxAttempts) {
    attempts.set(key, recent)
    const retryAfterSeconds = Math.max(1, Math.ceil((recent[0]! + windowMs - now) / 1000))
    return { ok: false, retryAfterSeconds }
  }
  recent.push(now)
  attempts.set(key, recent)
  if (attempts.size > 10_000) {
    for (const [entry, times] of attempts) {
      if ((times.at(-1) ?? 0) <= now - windowMs) attempts.delete(entry)
    }
  }
  return { ok: true }
}

/** Test helper — clears in-memory counters. */
export function resetRegistrationRateLimit() {
  attempts.clear()
}
