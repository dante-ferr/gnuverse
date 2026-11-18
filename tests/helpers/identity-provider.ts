import { randomBytes, randomUUID } from 'node:crypto'
import type { IdentityAccount, IdentityProvider } from '../../core/authn/identity-provider.ts'
import type { Role } from '../../core/authz/policy.ts'
import { fail } from '../../game-server/domain/validation.ts'

/** Independent issuer for domain tests. Production always uses the CMS adapter. */
export function createTestIdentityProvider(options: { now?: () => number; roles?: (profileId: string) => readonly Role[] } = {}): IdentityProvider {
  const now = options.now ?? Date.now
  const accounts = new Map<string, { account: IdentityAccount; password: string }>()
  const sessions = new Map<string, { email: string; expiresAt: number }>()
  const provider: IdentityProvider = {
    async register(email, password, nickname) {
      if (accounts.has(email) || [...accounts.values()].some((item) => item.account.nickname?.toLowerCase() === nickname.toLowerCase())) fail(409, 'Conta já existente.')
      accounts.set(email, { account: { identity: { provider: 'test', id: randomUUID() }, email, name: nickname, nickname, roles: ['member'] }, password })
      return provider.login(email, password)
    },
    async forgotPassword() {},
    async resetPassword() {},
    async verifyEmail() {},
    async login(identifier, password) {
      const handle = identifier.toLowerCase()
      const stored = accounts.get(handle)
        ?? [...accounts.values()].find((item) => item.account.nickname?.toLowerCase() === handle)
      if (!stored || stored.password !== password) fail(401, 'E-mail, apelido ou senha incorretos.')
      const token = randomBytes(32).toString('hex')
      sessions.set(token, { email: stored.account.email, expiresAt: now() + 604_800_000 })
      return { token, account: await provider.authenticate(token) }
    },
    async authenticate(token) {
      const session = sessions.get(token)
      if (!session || session.expiresAt <= now()) fail(401, 'Sessão expirada.')
      const account = accounts.get(session.email)!.account
      return { ...account, roles: options.roles?.(`test:${account.identity.id}`) ?? account.roles }
    },
    async logout(token) { await provider.authenticate(token); sessions.delete(token) },
  }
  return provider
}
