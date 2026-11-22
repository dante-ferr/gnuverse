type EnvMap = Record<string, string | undefined>

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

export function resolveGamePort(env: EnvMap = process.env): number {
  const raw = firstNonEmpty(env.GAME_PORT, env.PORT)
  return raw ? Number(raw) : 3002
}

export function resolveGameHost(env: EnvMap = process.env): string {
  const explicit = firstNonEmpty(env.GAME_HOST)
  if (explicit) return explicit
  if (firstNonEmpty(env.PORT) || env.NODE_ENV === 'production') return '0.0.0.0'
  return '127.0.0.1'
}

export function resolveCMSBaseURL(env: EnvMap = process.env): string {
  const explicit = firstNonEmpty(
    env.CMS_URL,
    env.CMS_SERVER_URL,
    env.NEXT_PUBLIC_CMS_URL,
  )
  if (explicit) return explicit.replace(/\/$/, '')
  const port = firstNonEmpty(env.CMS_PORT) ?? '3001'
  return `http://localhost:${port}`
}

export function resolveGameAllowedOrigins(env: EnvMap = process.env): string[] {
  const raw = firstNonEmpty(
    env.GAME_ALLOWED_ORIGINS,
    env.CMS_ALLOWED_ORIGINS,
    env.GNUVERSE_SITE_URL,
  )
  const source = raw ?? 'http://localhost:3000,http://127.0.0.1:3000'
  return source
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean)
}
