import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from 'node:crypto'
import type { Rules, User } from '../domain/types.ts'
import { fail, text } from '../domain/validation.ts'
import { GameStore } from '../persistence/game-store.ts'
import { WalletService } from '../economy/wallet-service.ts'
import { environmentActorRoles } from '../../core/authz/file-role-store.ts'
import { resolveActor, type RoleStore } from '../../core/authz/identity.ts'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const publicUser = (user: User) => ({
  id: user.id,
  nickname: user.nickname,
  roles: user.roles ?? ['member'],
})

export class AuthService {
  private store: GameStore
  private rules: Readonly<Rules>
  private now: () => number
  private wallet: WalletService
  private attempts = new Map<string, number[]>()
  private roleStore?: RoleStore
  constructor(
    store: GameStore,
    rules: Readonly<Rules>,
    now: () => number,
    wallet: WalletService,
    roleStore?: RoleStore,
  ) {
    this.store = store
    this.rules = rules
    this.now = now
    this.wallet = wallet
    this.roleStore = roleStore
  }
  authenticate(authorization: string | undefined): User {
    const token = /^Bearer ([a-f0-9]{64})$/.exec(authorization ?? '')?.[1]
    const session = token ? this.store.state.sessions[hash(token)] : undefined
    if (!session || session.expiresAt <= this.now())
      fail(401, 'Entre na sua conta.')
    const user = this.store.state.users[session.userId]
    if (!user) fail(401, 'Entre na sua conta.')
    this.assignRoles(user)
    return user
  }
  private assignRoles(user: User) {
    // Never trust roles in registration bodies or old persisted user records.
    const identity = { provider: 'game', id: user.id }
    const roles = this.roleStore ? resolveActor(identity, this.roleStore, ['member']).roles
      : environmentActorRoles(identity, ['member'])
    user.roles = [...new Set(['member' as const, ...roles])]
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
  login(body: Record<string, unknown>, register: boolean) {
    const email = text(body.email, 3, 254, 'E-mail').toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'E-mail inválido.')
    const password = body.password
    if (
      typeof password !== 'string' ||
      password.length < 8 ||
      password.length > 128
    )
      fail(400, 'A senha deve ter de 8 a 128 caracteres.')
    return this.store.atomic(() => {
      let user = Object.values(this.store.state.users).find(
        (item) => item.email === email,
      )
      if (register) {
        if (user) fail(409, 'E-mail já utilizado.')
        const nickname = text(body.nickname, 3, 32, 'Apelido')
        if (!/^[\p{L}\p{N}_-]+$/u.test(nickname))
          fail(400, 'Use letras, números, _ ou - no apelido.')
        if (
          Object.values(this.store.state.users).some(
            (item) => item.nickname.toLowerCase() === nickname.toLowerCase(),
          )
        )
          fail(409, 'Apelido já utilizado.')
        if (
          body.email !== undefined &&
          (typeof body.email !== 'string' ||
            body.email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))
        )
          fail(400, 'E-mail inválido.')
        const salt = randomBytes(16).toString('hex')
        user = {
          id: randomUUID(),
          nickname,
          email,
          salt,
          password: scryptSync(password, salt, 64).toString('hex'),
          balance: this.rules.initialBalance,
          coinAt: this.now(),
          lastAction: null,
        }
        this.store.state.users[user.id] = user
      } else {
        const check = scryptSync(
          password,
          user?.salt ?? 'dummy-salt-for-unknown-user',
          64,
        )
        if (!user || !timingSafeEqual(check, Buffer.from(user.password, 'hex')))
          fail(401, 'E-mail ou senha incorretos.')
      }
      this.assignRoles(user)
      for (const [key, session] of Object.entries(this.store.state.sessions))
        if (session.expiresAt <= this.now())
          delete this.store.state.sessions[key]
      const token = randomBytes(32).toString('hex')
      this.store.state.sessions[hash(token)] = {
        userId: user.id,
        expiresAt: this.now() + this.rules.tokenLifetimeMs,
      }
      return { token, user: publicUser(user), wallet: this.wallet.read(user) }
    })
  }
  logout(authorization: string | undefined) {
    this.authenticate(authorization)
    this.store.atomic(
      () => delete this.store.state.sessions[hash(authorization!.slice(7))],
    )
  }
}
