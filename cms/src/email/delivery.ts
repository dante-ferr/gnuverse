const EMAIL_DELIVERY_CODES = new Set([
  'ECONNECTION',
  'ECONNREFUSED',
  'ECONNRESET',
  'EDNS',
  'EENVELOPE',
  'ESOCKET',
  'ETIMEDOUT',
])

/** True when Nodemailer (or a wrapper around it) failed to hand the message to SMTP. */
export function isEmailDeliveryError(error: unknown): boolean {
  const pending: unknown[] = [error]
  const seen = new Set<unknown>()
  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || typeof current !== 'object' || seen.has(current)) continue
    seen.add(current)
    const record = current as Record<string, unknown>
    if (typeof record.code === 'string' && EMAIL_DELIVERY_CODES.has(record.code)) return true
    if (
      typeof record.message === 'string' &&
      /ECONNREFUSED|ECONNRESET|ETIMEDOUT|Greeting never received|Invalid login|socket hang up|connect E/i.test(
        record.message,
      )
    ) {
      return true
    }
    if (Array.isArray(record.errors)) pending.push(...record.errors)
    pending.push(record.cause, record.error, record.err)
  }
  return false
}

/** Shown when signup cannot send the confirmation message. Local text points at Mailpit. */
export function confirmationEmailFailureMessage(nodeEnv = process.env.NODE_ENV): string {
  if (nodeEnv === 'production') {
    return 'Não foi possível enviar o e-mail de confirmação. Tente novamente em instantes.'
  }
  return 'Não foi possível enviar o e-mail de confirmação. Execute make mailpit, abra a URL do inbox que o comando imprimir, depois tente novamente.'
}
