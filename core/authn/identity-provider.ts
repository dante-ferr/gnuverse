import type { Identity } from '../authz/identity.ts'
import type { Role } from '../authz/policy.ts'

/** Authentication contract; providers own credentials, sessions and canonical identity. */
export type IdentityAccount = {
  identity: Identity
  email: string
  name: string
  nickname?: string | null
  roles: readonly Role[]
  linkedIdentities?: Identity[]
}
export type IdentitySession = { token: string; account: IdentityAccount }
export interface IdentityProvider {
  login(email: string, password: string): Promise<IdentitySession>
  register(email: string, password: string, nickname: string): Promise<IdentitySession>
  authenticate(token: string): Promise<IdentityAccount>
  logout(token: string): Promise<void>
}
