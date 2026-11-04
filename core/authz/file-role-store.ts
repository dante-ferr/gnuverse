import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { ROLES, type Role } from './policy.ts'
import type { Identity, Principal, RoleStore } from './identity.ts'

export type RoleEntry = Principal & { name?: string; identities: Identity[] }
export function parseRoleEntries(source: string): RoleEntry[] {
  const data: unknown = JSON.parse(source)
  if (!Array.isArray(data)) throw new Error('Authorization registry must be an array.')
  const identities = new Set<string>()
  const principals = new Set<string>()
  return data.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid authorization principal.')
    const item = entry as Record<string, unknown>
    if (typeof item.id !== 'string' || !item.id.trim() || principals.has(item.id) ||
        !Array.isArray(item.roles) || !item.roles.every((role) => ROLES.includes(role as Role)) ||
        !Array.isArray(item.identities)) throw new Error('Invalid authorization principal.')
    principals.add(item.id)
    for (const identity of item.identities) {
      if (!identity || typeof identity.provider !== 'string' || !identity.provider.trim() ||
          typeof identity.id !== 'string' || !identity.id.trim()) throw new Error('Invalid authorization identity.')
      const key = JSON.stringify([identity.provider, identity.id])
      if (identities.has(key)) throw new Error('Duplicate authorization identity.')
      identities.add(key)
    }
    if (item.name !== undefined && (typeof item.name !== 'string' || item.name.length > 120))
      throw new Error('Invalid authorization name.')
    return item as RoleEntry
  })
}

/** Server-only adapter. Re-read on each decision so revocations affect existing sessions. */
export class FileRoleStore implements RoleStore {
  private path: string
  constructor(path: string) {
    if (!isAbsolute(path)) throw new Error('GNUVERSE_AUTHZ_FILE must be an absolute path.')
    this.path = path
  }
  find(identity: Identity): Principal | undefined {
    return parseRoleEntries(readFileSync(this.path, 'utf8')).find((entry) =>
      entry.identities.some((item) => item.provider === identity.provider && item.id === identity.id),
    )
  }
}

/** An explicitly configured registry is authoritative; CMS legacy roles are then ignored. */
export function authorizationFilePath(): string {
  return process.env.GNUVERSE_AUTHZ_FILE || resolve(process.env.GNUVERSE_DATA_DIR || '.content', 'authorization.json')
}

export function environmentActorRoles(identity: Identity, fallback: readonly Role[] = []): readonly Role[] {
  const path = authorizationFilePath()
  return process.env.GNUVERSE_AUTHZ_FILE || existsSync(path)
    ? new FileRoleStore(path).find(identity)?.roles ?? ['member'] : fallback
}
