import type { ServerProps } from 'payload'
import { can } from '../../../core/authz/policy.ts'
import { cmsActor } from '../access'

export function AccessLink({ user }: ServerProps) {
  if (!can(cmsActor(user), 'roles:manage')) return null
  return <a href="/acessos" style={{ display: 'block', padding: '12px 0', fontWeight: 600 }}>Pessoas e acessos ↗</a>
}
