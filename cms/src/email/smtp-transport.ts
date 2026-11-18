export type SmtpTransportOptions = {
  host: string
  port: number
  secure: boolean
  auth?: { user: string; pass: string }
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`Configure ${name} no ambiente do CMS.`)
  return value
}

/** Fail fast in production when confirmation mail cannot point at a real site or SMTP host. */
export function assertProductionEmailEnv(env: Record<string, string | undefined> = process.env) {
  if (env.NODE_ENV !== 'production') return
  required(env, 'SMTP_HOST')
  required(env, 'SMTP_FROM_ADDRESS')
  required(env, 'GNUVERSE_SITE_URL')
  const site = env.GNUVERSE_SITE_URL!.trim()
  try {
    const url = new URL(site)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('GNUVERSE_SITE_URL precisa ser uma URL http(s).')
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('GNUVERSE_SITE_URL')) throw error
    throw new Error('GNUVERSE_SITE_URL precisa ser uma URL absoluta (ex.: https://gnuverse.example).')
  }
}

export function resolveSmtpSecure(
  env: Record<string, string | undefined>,
  port: number,
): boolean {
  const raw = env.SMTP_SECURE?.trim().toLowerCase()
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return port === 465
}

/** Nodemailer transport options for local Mailpit or a production SMTP provider. */
export function buildSmtpTransportOptions(
  env: Record<string, string | undefined> = process.env,
): SmtpTransportOptions {
  assertProductionEmailEnv(env)
  const host = env.SMTP_HOST?.trim() || '127.0.0.1'
  const parsedPort = Number(env.SMTP_PORT?.trim() || '1025')
  const port = Number.isFinite(parsedPort) ? parsedPort : 1025
  const secure = resolveSmtpSecure(env, port)
  const user = env.SMTP_USER?.trim()
  const pass = (env.SMTP_PASS ?? env.SMTP_PASSWORD)?.toString()
  return {
    host,
    port,
    secure,
    ...(user ? { auth: { user, pass: pass ?? '' } } : {}),
  }
}
