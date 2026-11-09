import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Rules, User } from '../domain/types.ts'
import type { IdentityAccount, IdentityProvider } from '../../core/authn/identity-provider.ts'
import { fail, text } from '../domain/validation.ts'
import { GameStore } from '../persistence/game-store.ts'
import { WalletService } from '../economy/wallet-service.ts'

export const publicUser = (user: User) => ({ id: user.id, nickname: user.nickname, roles: user.roles ?? ['member'] })

/** Stores game profiles only. The identity provider validates all credentials and sessions. */
export class AuthService {
  private store: GameStore
  private rules: Readonly<Rules>
  private now: () => number
  private wallet: WalletService
  private identityProvider: IdentityProvider
  private attempts = new Map<string, number[]>()
  constructor(store: GameStore, rules: Readonly<Rules>, now: () => number, wallet: WalletService, identityProvider: IdentityProvider) {
    this.store = store; this.rules = rules; this.now = now; this.wallet = wallet; this.identityProvider = identityProvider
  }
  private token(authorization: string | undefined) {
    const token = /^Bearer (\S{1,8192})$/.exec(authorization ?? '')?.[1]
    if (!token) fail(401, 'Entre na sua conta.')
    return token
  }
  async authenticate(authorization: string | undefined): Promise<User> {
    const account = await this.identityProvider.authenticate(this.token(authorization))
    return this.store.atomic(() => this.profile(account))
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
  rateLimit(key: string) {
    const recent = (this.attempts.get(key) ?? []).filter(
      (time) => time > this.now() - 60000,
    )
    if (recent.length >= 15) fail(429, 'Muitas tentativas. Aguarde um minuto.')
    if (this.attempts.size > 10000) {
      for (const [ip, times] of this.attempts)
        if (times.at(-1)! <= this.now() - 60000) this.attempts.delete(ip)
    }
    recent.push(this.now())
    this.attempts.set(key, recent)
  }
  async login(body: Record<string, unknown>, register: boolean) {
    const email = text(body.email, 3, 254, 'E-mail').toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'E-mail inválido.')
    const password = body.password
    if (typeof password !== 'string' || password.length < 1 || password.length > 128)
      fail(400, 'Informe uma senha de até 128 caracteres.')
    let nickname = ''
    if (register) {
      nickname = text(body.nickname, 3, 32, 'Apelido')
      if (!/^[\p{L}\p{N}_-]+$/u.test(nickname)) fail(400, 'Use letras, números, _ ou - no apelido.')
    }
    const session = register ? await this.identityProvider.register(email, password, nickname)
      : await this.identityProvider.login(email, password)
    return this.store.atomic(() => {
      const user = this.profile(session.account, password)
      return { token: session.token, user: publicUser(user), wallet: this.wallet.read(user) }
    })
  }
  async logout(authorization: string | undefined) {
    await this.identityProvider.logout(this.token(authorization))
  }
}
