export const GAME_API_URL = (
  process.env.NEXT_PUBLIC_GAME_API_URL || 'http://localhost:3002'
).replace(/\/$/, '')

/** HTTP transport only; session and interface state belong to their hooks. */
export class GameApi {
  constructor(
    private readonly token: string,
    private readonly onExpired: () => void,
  ) {}

  async request<T>(
    path: string,
    body?: unknown,
    method: 'GET' | 'POST' | 'DELETE' = body === undefined ? 'GET' : 'POST',
  ): Promise<T> {
    const response = await fetch(`${GAME_API_URL}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
    const data = await response.json()
    if (!response.ok) {
      if (response.status === 401 && this.token) this.onExpired()
      throw new Error(data.error || 'Não foi possível concluir a ação.')
    }
    return data as T
  }

  stream(towerId: string) {
    return new EventSource(
      `${GAME_API_URL}/api/towers/${encodeURIComponent(towerId)}/events`,
    )
  }
}
