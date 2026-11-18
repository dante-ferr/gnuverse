import { emailVerificationEnabled } from './settings'
import { buildSmtpTransportOptions } from './smtp-transport'

export { emailVerificationEnabled }

export async function buildEmailAdapter() {
  if (!emailVerificationEnabled) return undefined
  const { nodemailerAdapter } = await import('@payloadcms/email-nodemailer')
  const seeding = process.env.CMS_SEEDING === '1'
  return nodemailerAdapter({
    defaultFromAddress: process.env.SMTP_FROM_ADDRESS?.trim() || 'gnuverse@localhost',
    defaultFromName: process.env.SMTP_FROM_NAME?.trim() || 'GNUverse',
    skipVerify: true,
    // Seed scripts must not depend on Mailpit or any SMTP listener.
    transportOptions: seeding
      ? { jsonTransport: true }
      : buildSmtpTransportOptions(),
  })
}
