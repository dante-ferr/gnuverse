import type {
  IdentityAccount,
  IdentityProvider,
  IdentityRegisterResult,
  IdentitySession,
} from '../../core/authn/identity-provider.ts'
import { ROLES } from '../../core/authz/policy.ts'
import { fail } from '../domain/validation.ts'

/** Payload is an adapter to the identity contract, never a second credential database. */
export class CMSIdentityProvider implements IdentityProvider {
  private base: string
  constructor(base = process.env.CMS_URL || `http://localhost:${process.env.CMS_PORT || 3001}`) {
    this.base = base.replace(/\/$/, '')
  }
  private async request(path: string, token?: string, body?: unknown, sessionError = 'Sua sessão expirou. Entre novamente.') {
    let response: Response
    try {
      response = await fetch(`${this.base}/api${path}`, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store',
        headers: { ...(token ? { Authorization: `JWT ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000),
      })
    } catch { fail(503, 'O serviço de contas está indisponível. Tente novamente em instantes.') }
    if (response.status === 403 && !token) {
      const result = await response.json().catch(() => ({}))
      const message = typeof result.message === 'string' ? result.message : 'Confirme seu e-mail antes de entrar.'
      fail(403, message)
    }
    if (response.status === 401 || response.status === 403) fail(401, token ? sessionError : 'E-mail, apelido ou senha incorretos.')
    if (response.status === 429) fail(429, 'Muitas tentativas. Aguarde um minuto.')
    if (!response.ok) {
      if (path === '/identity/register' && [400, 409, 422].includes(response.status)) {
        const result = await response.json().catch(() => ({}))
        fail(response.status, typeof result.error === 'string' ? result.error : 'Não foi possível criar a conta. Confira os dados informados.')
      }
      fail(503, 'O serviço de contas não conseguiu concluir a solicitação.')
    }
    return response.json()
  }
  async login(identifier: string, password: string): Promise<IdentitySession> {
    const handle = identifier.toLowerCase().trim()
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handle)
    const result = await this.request(
      '/users/login',
      undefined,
      isEmail ? { email: handle, password } : { username: handle, password },
    )
    if (typeof result.token !== 'string') fail(503, 'O serviço de contas não retornou uma sessão válida.')
    return {
      token: result.token,
      account: await this.authenticate(result.token, 'A senha foi aceita, mas a sessão da conta não pôde ser aberta.'),
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
    return { token: result.token, account: await this.authenticate(result.token, 'A conta foi criada, mas a sessão não pôde ser aberta.') }
  }
  async forgotPassword(email: string) {
    await this.request('/users/forgot-password', undefined, { email })
  }
  async resetPassword(token: string, password: string) {
    await this.request('/users/reset-password', undefined, { token, password })
  }
  async verifyEmail(token: string) {
    await this.request(`/users/verify/${encodeURIComponent(token)}`, undefined, {})
  }
  async authenticate(token: string, sessionError?: string): Promise<IdentityAccount> {
    const { account } = await this.request('/identity/me', token, undefined, sessionError)
    if (!account || account.identity?.provider !== 'cms' || typeof account.identity.id !== 'string' ||
        typeof account.email !== 'string' || typeof account.name !== 'string' || !Array.isArray(account.roles) ||
        !account.roles.every((role: unknown) => ROLES.includes(role as typeof ROLES[number])))
      fail(503, 'O serviço de contas retornou uma identidade inválida.')
    return account
  }
  async logout(token: string) { await this.request('/users/logout', token, {}) }
}
