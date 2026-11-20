const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', ''])

export const GAME_API_URL = (
  process.env.NEXT_PUBLIC_GAME_API_URL || 'http://localhost:3002'
).replace(/\/$/, '')

/**
 * Resolves the game API base URL for browser requests.
 * Returns null when deployed to a non-local host without NEXT_PUBLIC_GAME_API_URL.
 */
export function resolveGameApiUrl(
  configuredUrl = process.env.NEXT_PUBLIC_GAME_API_URL,
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
): string | null {
  const trimmed = configuredUrl?.trim().replace(/\/$/, '')
  if (trimmed) return trimmed
  if (LOCAL_HOSTNAMES.has(hostname)) return 'http://localhost:3002'
  return null
}

function isCredentialRequest(path: string) {
  return (
    path === '/api/login' ||
    path === '/api/register' ||
    path === '/api/forgot-password' ||
    path === '/api/reset-password' ||
    path.startsWith('/api/verify-email/')
  )
}

/** HTTP transport only; session and interface state belong to their hooks. */
export class GameApi {
  private readonly token: string
  private readonly onExpired: () => void

  constructor(token: string, onExpired: () => void) {
    this.token = token
    this.onExpired = onExpired
  }

  async request<T>(
    path: string,
    body?: unknown,
    method: 'GET' | 'POST' | 'DELETE' = body === undefined ? 'GET' : 'POST',
  ): Promise<T> {
    const baseUrl = resolveGameApiUrl()
    if (!baseUrl) {
      throw new Error('O servidor do jogo ainda não foi configurado neste ambiente.')
    }
    const credentials = isCredentialRequest(path)
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(this.token && !credentials ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      })
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'TimeoutError') {
        throw new Error('O servidor do jogo demorou para responder. Tente novamente.')
      }
      throw new Error(
        'Não foi possível conectar ao servidor do jogo. Confira se o backend está em execução.',
      )
    }
    const data = await response.json()
    if (!response.ok) {
      if (response.status === 401 && this.token && !credentials) this.onExpired()
      throw new Error(data.error || 'Não foi possível concluir a ação.')
    }
    return data as T
  }

  stream(roomId: string) {
    const baseUrl = resolveGameApiUrl() || GAME_API_URL
    return new EventSource(
      `${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/events`,
    )
  }
}
