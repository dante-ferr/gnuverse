import { extractCmsErrorMessage } from './blog-submission.ts'
import type { Role } from '../../core/authz/policy.ts'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', ''])

/**
 * Resolves the CMS base URL for browser requests.
 * Returns null when deployed to a non-local host without NEXT_PUBLIC_CMS_URL.
 */
export function resolveCmsBaseUrl(
  configuredUrl = process.env.NEXT_PUBLIC_CMS_URL,
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
): string | null {
  const trimmed = configuredUrl?.trim().replace(/\/$/, '')
  if (trimmed) return trimmed
  if (LOCAL_HOSTNAMES.has(hostname)) {
    const port = process.env.NEXT_PUBLIC_CMS_PORT?.trim() || process.env.CMS_PORT?.trim() || '3001'
    return `http://localhost:${/^\d+$/.test(port) ? port : '3001'}`
  }
  return null
}

async function fetchCms(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'TimeoutError') {
      throw new Error(
        'O servidor editorial (CMS) demorou para responder. Tente novamente.',
      )
    }
    throw new Error(
      'Não foi possível conectar ao servidor editorial (CMS). Confira se o backend está em execução.',
    )
  }
}

/**
 * Authenticates or registers a blog contributor directly against Payload CMS,
 * without requiring the game server to be deployed.
 */
export async function authenticateViaCms(
  cmsUrl: string,
  mode: 'login' | 'register',
  credentials: { email: string; password: string; nickname?: string },
): Promise<
  | { verificationRequired: true; message: string }
  | { verificationRequired: false; token: string }
> {
  if (mode === 'register') {
    const response = await fetchCms(`${cmsUrl}/api/identity/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
        nickname: credentials.nickname,
      }),
      signal: AbortSignal.timeout(120000),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(
        typeof data?.error === 'string'
          ? data.error
          : extractCmsErrorMessage(data, response.status),
      )
    }
    if (data?.verificationRequired) {
      return {
        verificationRequired: true,
        message:
          typeof data.message === 'string'
            ? data.message
            : 'Enviamos um e-mail de confirmação. Abra o link antes de entrar.',
      }
    }
    if (typeof data?.token !== 'string') {
      throw new Error('Não foi possível concluir o cadastro no CMS.')
    }
    return { verificationRequired: false, token: data.token }
  }

  const handle = credentials.email.trim()
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handle)
  const response = await fetchCms(`${cmsUrl}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      isEmail
        ? { email: handle.toLowerCase(), password: credentials.password }
        : { username: handle.toLowerCase(), password: credentials.password },
    ),
    signal: AbortSignal.timeout(120000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || typeof data?.token !== 'string') {
    throw new Error(extractCmsErrorMessage(data, response.status))
  }
  return { verificationRequired: false, token: data.token }
}

export type CmsIdentityUser = {
  id: string
  nickname: string
  roles?: readonly Role[]
}

/** Fetches the signed-in account directly from Payload CMS when game-server is not configured. */
export async function fetchCmsIdentity(
  cmsUrl: string,
  token: string,
): Promise<CmsIdentityUser | null> {
  const response = await fetch(`${cmsUrl}/api/identity/me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(120000),
  })
  if (response.status === 401 || response.status === 403) return null
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const data = await response.json().catch(() => null)
  const account = data?.account
  if (!account || typeof account !== 'object') return null
  const id = String(account.identity?.id ?? '')
  const nickname =
    (typeof account.nickname === 'string' && account.nickname.trim()) ||
    (typeof account.name === 'string' && account.name.trim()) ||
    (typeof account.email === 'string' && account.email.trim()) ||
    ''
  if (!id || !nickname) return null
  const roles = Array.isArray(account.roles) ? (account.roles as readonly Role[]) : undefined
  return { id, nickname, roles }
}
