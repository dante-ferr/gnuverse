import type { Actor, Role } from './policy.ts'

export type Identity = { provider: string; id: string }
export type Principal = { id: string; roles: readonly Role[] }
/** An absent assignment differs from an explicit assignment with no roles. */
export interface RoleStore {
  find(identity: Identity): Principal | undefined
}

export function resolveActor(identity: Identity, store: RoleStore, fallback: readonly Role[] = []): Actor {
  const principal = store.find(identity)
  // Keep the domain account ID for ownership checks. Principal IDs link assignments across domains.
  return { id: identity.id, roles: principal?.roles ?? fallback }
}
