/** Public site origin for links in authentication e-mails (not the CMS URL). */
export function getSiteURL(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.GNUVERSE_SITE_URL?.trim().replace(/\/$/, '')
  if (explicit) return explicit
  const port = env.SITE_PORT?.trim() || '3000'
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    return 'http://localhost:3000'
  }
  return `http://localhost:${port}`
}