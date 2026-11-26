import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Rules, User } from '../domain/types.ts'
import type { IdentityAccount, IdentityProvider } from '../../core/authn/identity-provider.ts'
import { fail, text } from '../domain/validation.ts'
import { GameStore } from '../persistence/game-store.ts'
import { WalletService } from '../economy/wallet-service.ts'

/** How long a verified bearer token skips the identity provider round-trip. */
const VERIFIED_TOKEN_TTL_MS = 30_000

export const publicUser = (user: User) => ({ id: user.id, nickname: user.nickname, roles: user.roles ?? ['member'] })

/** Stores game profiles only. The identity provider validates all credentials and sessions. */
export class AuthService {
  private store: GameStore
  private rules: Readonly<Rules>
  private now: () => number
  private wallet: WalletService
  private identityProvider: IdentityProvider
  private attempts = new Map<string, number[]>()
  /**
   * Recently verified bearer tokens. Every game request used to round-trip to the
   * identity provider and rewrite the whole store; within this window a known
   * token resolves locally. Role or revocation changes apply after the window.
   */
  private verified = new Map<string, { userId: string; expiresAt: number }>()
  constructor(store: GameStore, rules: Readonly<Rules>, now: () => number, wallet: WalletService, identityProvider: IdentityProvider) {
    this.store = store; this.rules = rules; this.now = now; this.wallet = wallet; this.identityProvider = identityProvider
  }
  private token(authorization: string | undefined) {
    const token = /^Bearer (\S{1,8192})$/.exec(authorization ?? '')?.[1]
    if (!token) fail(401, 'Entre na sua conta.')
    return token
  }
  warmup() {
    this.identityProvider.warmup?.()
  }
  /**
   * `reuse` lets hot gameplay requests (placements, heartbeats, chat) accept a token
   * verified within the last few seconds. Everything else asks the identity provider,
   * so role grants and revocations apply immediately to privileged actions.
   */
  async authenticate(authorization: string | undefined, options: { reuse?: boolean } = {}): Promise<User> {
    const token = this.token(authorization)
    const cached = options.reuse ? this.verified.get(token) : undefined
    if (cached && cached.expiresAt > this.now()) {
      const user = this.store.state.users[cached.userId]
      if (user) return user
    }
    const account = await this.identityProvider.authenticate(token)
    const user = this.store.atomic(() => this.profile(account))
    this.rememberToken(token, user.id)
    return user
  }
  private rememberToken(token: string, userId: string) {
    const now = this.now()
    if (this.verified.size >= 10000)
      for (const [key, entry] of this.verified)
        if (entry.expiresAt <= now) this.verified.delete(key)
    if (this.verified.size >= 10000) this.verified.clear()
    this.verified.set(token, { userId, expiresAt: now + VERIFIED_TOKEN_TTL_MS })
  }
  async me(authorization: string | undefined) {
    const token = this.token(authorization)
    const account = await this.identityProvider.authenticate(token)
    const result = this.store.atomic(() => {
      const user = this.profile(account)
      return { user: publicUser(user), wallet: this.wallet.read(user) }
    })
    this.rememberToken(token, result.user.id)
    return result
  }
  private profile(account: IdentityAccount, password?: string): User {
    const matches = (user: User) => user.identity?.provider === account.identity.provider && user.identity.id === account.identity.id
    let user = Object.values(this.store.state.users).find(matches)
    if (!user) {
      // Existing accounts migrate only with an explicit administrative link or proof
      // of both passwords. Matching an unverified email alone is never ownership proof.
      const linked = account.linkedIdentities?.find((identity) => identity.provider === 'game' && this.store.state.users[identity.id])
      const candidate = linked ? this.store.state.users[linked.id]
        : Object.values(this.store.state.users).find((item) => item.email.toLowerCase() === account.email.toLowerCase())
      if (candidate) {
        const ownsLegacy = !candidate.identity && Boolean(linked || (password && candidate.salt && candidate.password?.length === 128 &&
          timingSafeEqual(scryptSync(password, candidate.salt, 64), Buffer.from(candidate.password, 'hex'))))
        if (!ownsLegacy) fail(409, 'Já existe um perfil antigo do jogo com este e-mail. Entre com a senha que era usada nos dois serviços ou peça ao administrador para vincular as contas em Pessoas e acessos.')
        user = candidate
      } else {
        const base = (account.nickname || account.name).replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 24) || 'jogador'
        let nickname = base.padEnd(3, '_')
        while (Object.values(this.store.state.users).some((item) => item.nickname.toLowerCase() === nickname.toLowerCase()))
          nickname = `${base.slice(0, 23)}_${randomUUID().slice(0, 8)}`
        user = { id: `${account.identity.provider}:${account.identity.id}`, nickname, email: account.email,
          balance: this.rules.initialBalance, coinAt: this.now(), lastAction: null }
        this.store.state.users[user.id] = user
      }
    }
    user.identity = account.identity
    user.email = account.email
    user.roles = [...new Set(['member' as const, ...account.roles])]
    delete user.salt
    delete user.password
    return user
  }
  checkRateLimit(key: string) {
    const recent = (this.attempts.get(key) ?? []).filter(
      (time) => time > this.now() - 60000,
    )
    if (recent.length >= 15) fail(429, 'Muitas tentativas. Aguarde um minuto.')
    if (recent.length > 0) this.attempts.set(key, recent)
    else this.attempts.delete(key)
  }
  recordRateLimitAttempt(key: string) {
    const recent = (this.attempts.get(key) ?? []).filter(
      (time) => time > this.now() - 60000,
    )
    if (this.attempts.size > 10000) {
      for (const [ip, times] of this.attempts)
        if ((times.at(-1) ?? 0) <= this.now() - 60000) this.attempts.delete(ip)
    }
    recent.push(this.now())
    this.attempts.set(key, recent)
  }
  rateLimit(key: string) {
    this.checkRateLimit(key)
    this.recordRateLimitAttempt(key)
  }
  async login(body: Record<string, unknown>, register: boolean) {
    const password = body.password
    if (typeof password !== 'string' || password.length < 1 || password.length > 128)
      fail(400, 'Informe uma senha de até 128 caracteres.')
    if (register) {
      const email = text(body.email, 3, 254, 'E-mail').toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'E-mail inválido.')
      const nickname = text(body.nickname, 3, 32, 'Apelido')
      if (!/^[\p{L}\p{N}_-]+$/u.test(nickname)) fail(400, 'Use letras, números, _ ou - no apelido.')
      const registered = await this.identityProvider.register(email, password, nickname)
      if ('verificationRequired' in registered) {
        return { verificationRequired: true, message: registered.message }
      }
      return this.store.atomic(() => {
        const user = this.profile(registered.account, password)
        return { token: registered.token, user: publicUser(user), wallet: this.wallet.read(user) }
      })
    }
    const raw = body.email ?? body.username ?? body.login
    const identifier = text(raw, 3, 254, 'E-mail ou apelido').toLowerCase()
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
    if (!isEmail && !/^[\p{L}\p{N}_-]{3,32}$/u.test(identifier)) {
      fail(400, 'Informe um e-mail ou apelido válido.')
    }
    const session = await this.identityProvider.login(identifier, password)
    return this.store.atomic(() => {
      const user = this.profile(session.account, password)
      return { token: session.token, user: publicUser(user), wallet: this.wallet.read(user) }
    })
  }
  async forgotPassword(body: Record<string, unknown>) {
    const email = text(body.email, 3, 254, 'E-mail').toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'E-mail inválido.')
    await this.identityProvider.forgotPassword(email)
    return { message: 'Se o e-mail existir na base, você receberá instruções em instantes.' }
  }
  async resetPassword(body: Record<string, unknown>) {
    const token = text(body.token, 8, 512, 'Token')
    const password = body.password
    if (typeof password !== 'string' || password.length < 1 || password.length > 128)
      fail(400, 'Informe uma senha de até 128 caracteres.')
    await this.identityProvider.resetPassword(token, password)
    return { message: 'Senha redefinida. Agora você já pode entrar.' }
  }
  async verifyEmail(token: string) {
    const value = token.trim()
    if (value.length < 8 || value.length > 512) fail(400, 'Link de verificação inválido.')
    const result = await this.identityProvider.verifyEmail(value)
    return {
      message: result && typeof result.message === 'string' && result.message.trim()
        ? result.message.trim()
        : 'E-mail confirmado. Agora você já pode entrar.',
    }
  }
  async logout(authorization: string | undefined) {
    const token = this.token(authorization)
    this.verified.delete(token)
    await this.identityProvider.logout(token)
  }
}
