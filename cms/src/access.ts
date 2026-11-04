import type { Access, FieldAccess, PayloadRequest } from 'payload'
import { can, type Actor } from '../../core/authz/policy.ts'
import { environmentActorRoles } from '../../core/authz/file-role-store.ts'

type CMSUser = { id: string | number; role?: string } | null | undefined
export function cmsActor(user: CMSUser): Actor | null {
  if (!user) return null
  return {
    id: String(user.id),
    roles: environmentActorRoles({ provider: 'cms', id: String(user.id) },
      user.role === 'admin' ? ['admin'] : user.role === 'editor' ? ['blog-editor'] : ['member']),
  }
}
export const isAdmin: Access = ({ req }) => can(cmsActor(req.user), 'roles:manage')
export const isEditor: Access = ({ req }) => can(cmsActor(req.user), 'article:manage')
export const adminField: FieldAccess = ({ req }) => can(cmsActor(req.user), 'roles:manage')
export const canAccessCMS = ({ req }: { req: PayloadRequest }) => can(cmsActor(req.user), 'cms:access')
export const manageMedia: Access = ({ req }) => can(cmsActor(req.user), 'media:manage')
export const deleteMedia: Access = ({ req }) => can(cmsActor(req.user), 'media:delete')
export const publishedOrEditor: Access = ({ req }) =>
  isEditor({ req }) ? true : { _status: { equals: 'published' } }
