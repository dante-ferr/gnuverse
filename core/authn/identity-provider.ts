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
export type IdentityRegisterResult =
  | IdentitySession
  | { verificationRequired: true; message: string }
export interface IdentityProvider {
  login(email: string, password: string): Promise<IdentitySession>
  register(email: string, password: string, nickname: string): Promise<IdentityRegisterResult>
  authenticate(token: string): Promise<IdentityAccount>
  logout(token: string): Promise<void>
  forgotPassword(email: string): Promise<void>
  resetPassword(token: string, password: string): Promise<void>
  verifyEmail(token: string): Promise<void>
}
