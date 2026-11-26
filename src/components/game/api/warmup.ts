import { resolveCmsBaseUrl } from '../../../lib/cms-client.ts'
import { resolveGameApiUrl } from './game-api.ts'

const WARMUP_INTERVAL_MS = 4 * 60_000
let lastWarmAt = 0

export function resetAuthWarmupForTests() {
  lastWarmAt = 0
}

/**
 * Wakes both the game API and the CMS identity service in parallel before the
 * user finishes filling out an auth form, avoiding sequential Render cold starts.
 */
export function warmAuthBackends(now = Date.now()) {
  if (now - lastWarmAt < WARMUP_INTERVAL_MS) return
  const gameUrl = resolveGameApiUrl()
  const cmsUrl = resolveCmsBaseUrl()
  if (!gameUrl && !cmsUrl) return
  lastWarmAt = now
  if (gameUrl) {
    void fetch(`${gameUrl}/api/warmup`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    }).catch(() => {})
  }
  if (cmsUrl) {
    void fetch(`${cmsUrl}/api/access`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    }).catch(() => {})
  }
}
