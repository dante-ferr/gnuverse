import type {
  IdentityAccount,
  IdentityProvider,
  IdentityRegisterResult,
  IdentitySession,
} from '../../core/authn/identity-provider.ts'
import { ROLES } from '../../core/authz/policy.ts'
import { fail } from '../domain/validation.ts'
import { cmsErrorMessage } from './cms-error.ts'
import { resolveCMSBaseURL } from '../config/runtime-env.ts'

/** Payload is an adapter to the identity contract, never a second credential database. */
export class CMSIdentityProvider implements IdentityProvider {
  private base: string
  private lastWarmAt = 0
  private warmInFlight: Promise<void> | null = null

  constructor(base = resolveCMSBaseURL()) {
    this.base = base.replace(/\/$/, '')
  }

  warmup(): void {
    const now = Date.now()
    if (this.warmInFlight || now - this.lastWarmAt < 4 * 60_000) return
    this.warmInFlight = fetch(`${this.base}/api/access`, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    })
      .then((response) => {
        if (response.status < 500) this.lastWarmAt = Date.now()
      })
      .catch(() => {})
      .finally(() => {
        this.warmInFlight = null
      })
  }

  private parseAccount(account: unknown): IdentityAccount {
    const candidate = account as IdentityAccount | undefined
    if (
      !candidate ||
      candidate.identity?.provider !== 'cms' ||
      typeof candidate.identity.id !== 'string' ||
      typeof candidate.email !== 'string' ||
      typeof candidate.name !== 'string' ||
      !Array.isArray(candidate.roles) ||
      !candidate.roles.every((role: unknown) => ROLES.includes(role as (typeof ROLES)[number]))
    ) {
      fail(503, 'O serviço de contas retornou uma identidade inválida.')
    }
    return candidate
  }

  private async request(
    path: string,
    token?: string,
    body?: unknown,
    sessionError = 'Sua sessão expirou. Entre novamente.',
  ) {
    let response: Response
    try {
      response = await fetch(`${this.base}/api${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        redirect: 'error',
        cache: 'no-store',
        headers: {
          ...(token ? { Authorization: `JWT ${token}` } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(token ? 15000 : 90000),
      })
    } catch {
      fail(503, 'O serviço de contas está indisponível. Tente novamente em instantes.')
    }

    if (response.status < 500) {
      this.lastWarmAt = Date.now()
    }
    if (response.status === 404 && path === '/identity/login') {
      return null
    }

    const result = await response.json().catch(() => ({}))

    if (response.status === 403 && !token) {
      fail(403, cmsErrorMessage(result, 'Confirme seu e-mail antes de entrar.'))
    }
    if (response.status === 401 || response.status === 403) {
      fail(401, token ? sessionError : 'E-mail, apelido ou senha incorretos.')
    }
    if (response.status === 429) {
      fail(429, cmsErrorMessage(result, 'Muitas tentativas. Aguarde um minuto.'))
    }
    if (!response.ok) {
      const message = cmsErrorMessage(result, '')
      if (path === '/identity/register') {
        if (message && [400, 409, 422, 500, 503].includes(response.status)) {
          fail(response.status === 500 ? 503 : response.status, message)
        }
        if ([400, 409, 422].includes(response.status)) {
          fail(response.status, 'Não foi possível criar a conta. Confira os dados informados.')
        }
      }
      if (
        message &&
        (
          path === '/identity/verify-email' ||
          path === '/identity/login' ||
          path === '/users/forgot-password' ||
          path === '/users/reset-password' ||
          path === '/users/login' ||
          path.startsWith('/users/verify/')
        )
      ) {
        fail(
          [400, 404, 410, 422].includes(response.status) ? response.status : 503,
          message,
        )
      }
      fail(503, message || 'O serviço de contas não conseguiu concluir a solicitação.')
    }
    return result
  }

  async login(identifier: string, password: string): Promise<IdentitySession> {
    const handle = identifier.toLowerCase().trim()
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handle)
    const payload = isEmail ? { email: handle, password } : { username: handle, password }
    const result =
      (await this.request('/identity/login', undefined, payload)) ??
      (await this.request('/users/login', undefined, payload))
    if (!result || typeof result.token !== 'string') {
      fail(503, 'O serviço de contas não retornou uma sessão válida.')
    }
    return {
      token: result.token,
      account: result.account !== undefined
        ? this.parseAccount(result.account)
        : await this.authenticate(result.token, 'A senha foi aceita, mas a sessão da conta não pôde ser aberta.'),
    }
  }

  async register(email: string, password: string, nickname: string): Promise<IdentityRegisterResult> {
    const result = await this.request('/identity/register', undefined, { email, password, nickname })
    if (result.verificationRequired === true) {
      return {
        verificationRequired: true,
        message: typeof result.message === 'string'
          ? result.message
          : 'Enviamos um e-mail de confirmação. Abra o link antes de entrar.',
      }
    }
    if (typeof result.token !== 'string') fail(503, 'O serviço de contas não retornou uma sessão válida.')
    return {
      token: result.token,
      account: result.account !== undefined
        ? this.parseAccount(result.account)
        : await this.authenticate(result.token, 'A conta foi criada, mas a sessão não pôde ser aberta.'),
    }
  }

  async forgotPassword(email: string) {
    await this.request('/users/forgot-password', undefined, { email })
  }

  async resetPassword(token: string, password: string) {
    await this.request('/users/reset-password', undefined, { token, password })
  }

  async verifyEmail(token: string) {
    const result = await this.request('/identity/verify-email', undefined, { token })
    return {
      message: typeof result.message === 'string'
        ? result.message
        : 'E-mail confirmado. Agora você já pode entrar.',
    }
  }

  async authenticate(token: string, sessionError?: string): Promise<IdentityAccount> {
    const { account } = await this.request('/identity/me', token, undefined, sessionError)
    return this.parseAccount(account)
  }

  async logout(token: string) {
    await this.request('/users/logout', token, {})
  }
}
