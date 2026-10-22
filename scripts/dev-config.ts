export function getDevConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const port = (name: string, fallback: string) => {
    const value = env[name] ?? fallback
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
      throw new Error(`${name} deve ser uma porta entre 1 e 65535.`)
    }
    return String(Number(value))
  }
  const sitePort = port('SITE_PORT', '3000')
  const gamePort = port('GAME_PORT', '3002')
  const cmsPort = port('CMS_PORT', '3001')
  if (new Set([sitePort, gamePort, cmsPort]).size !== 3) {
    throw new Error(
      'SITE_PORT, GAME_PORT e CMS_PORT precisam usar portas diferentes.',
    )
  }
  const gameURL = `http://localhost:${gamePort}`
  const allowedOrigins = [
    ...new Set([
      ...(env.GAME_ALLOWED_ORIGINS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      `http://localhost:${sitePort}`,
      `http://127.0.0.1:${sitePort}`,
    ]),
  ].join(',')
  return { sitePort, gamePort, gameURL, allowedOrigins }
}
