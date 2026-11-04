/** Pure authorization policy. No framework, storage, environment or HTTP dependencies. */
export const ROLES = ['admin', 'blog-editor', 'game-moderator', 'quiz-editor', 'member'] as const
export type Role = typeof ROLES[number]
export const PERMISSIONS = [
  'roles:manage', 'cms:access', 'article:manage', 'media:manage', 'media:delete',
  'tower:update:any', 'tower:delete:any', 'tower:restore:any',
  'tower:update:own', 'tower:delete:own', 'quiz:manage',
] as const
export type Permission = typeof PERMISSIONS[number]
export type Actor = { id: string; roles: readonly Role[] }
export type OwnedResource = { ownerId: string }

const grants: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  'blog-editor': ['cms:access', 'article:manage', 'media:manage'],
  'game-moderator': ['tower:update:any', 'tower:delete:any', 'tower:restore:any'],
  'quiz-editor': ['quiz:manage'],
  member: ['tower:update:own', 'tower:delete:own'],
}

export function can(actor: Actor | null | undefined, permission: Permission, resource?: OwnedResource): boolean {
  if (!actor || !PERMISSIONS.includes(permission)) return false
  if (permission.endsWith(':own') && (!resource || resource.ownerId !== actor.id)) return false
  return actor.roles.some((role) => Object.hasOwn(grants, role) && grants[role].includes(permission))
}

export function canManageTower(actor: Actor | null | undefined, action: 'update' | 'delete', ownerId: string) {
  return can(actor, `tower:${action}:any`) || can(actor, `tower:${action}:own`, { ownerId })
}
