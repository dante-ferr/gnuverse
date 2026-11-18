/** Prefer Payload/CMS error fields over a generic fallback. */
export function cmsErrorMessage(result: unknown, fallback: string): string {
  if (!result || typeof result !== 'object') return fallback
  const record = result as Record<string, unknown>
  if (typeof record.error === 'string' && record.error.trim()) return record.error.trim()
  if (typeof record.message === 'string' && record.message.trim()) return record.message.trim()
  if (Array.isArray(record.errors)) {
    for (const entry of record.errors) {
      if (!entry || typeof entry !== 'object') continue
      const message = (entry as Record<string, unknown>).message
      if (typeof message === 'string' && message.trim()) return message.trim()
    }
  }
  return fallback
}
