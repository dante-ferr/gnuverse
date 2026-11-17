import { emailVerificationEnabled } from './settings'

export { emailVerificationEnabled }

export async function buildEmailAdapter() {
  if (!emailVerificationEnabled) return undefined
  const { nodemailerAdapter } = await import('@payloadcms/email-nodemailer')
  const host = process.env.SMTP_HOST?.trim() || '127.0.0.1'
  const port = Number(process.env.SMTP_PORT?.trim() || '1025')
  return nodemailerAdapter({
    defaultFromAddress: process.env.SMTP_FROM_ADDRESS?.trim() || 'gnuverse@localhost',
    defaultFromName: process.env.SMTP_FROM_NAME?.trim() || 'GNUverse',
    skipVerify: true,
    transportOptions: {
      host,
      port: Number.isFinite(port) ? port : 1025,
      secure: false,
    },
  })
}
