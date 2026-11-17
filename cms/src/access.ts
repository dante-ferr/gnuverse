import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'
import { can, type Actor } from '../../core/authz/policy.ts'
import { environmentActorRoles } from '../../core/authz/file-role-store.ts'

type CMSUser = { id: string | number; role?: string } | null | undefined

function legacyCmsRoles(role: string | undefined): Actor['roles'] {
  if (role === 'admin') return ['admin']
  if (role === 'editor' || role === 'reviewer') return ['blog-editor']
  return ['member']
}

export function cmsActor(user: CMSUser): Actor | null {
  if (!user) return null
  return {
    id: String(user.id),
    roles: environmentActorRoles(
      { provider: 'cms', id: String(user.id) },
      legacyCmsRoles(user.role),
    ),
  }
}

const reviewerRoles: readonly string[] = ['admin', 'reviewer', 'editor']

type RequestCheck = ({ req }: { req: PayloadRequest }) => boolean

export const isAdmin: RequestCheck = ({ req }) => req.user?.role === 'admin'
export const isReviewer: RequestCheck = ({ req }) =>
  reviewerRoles.includes(req.user?.role ?? '')
export const isAuthor: RequestCheck = ({ req }) =>
  req.user?.role === 'author' || req.user?.role === 'member'
export const canCreateArticle: RequestCheck = ({ req }) =>
  isReviewer({ req }) || isAuthor({ req })

export const adminField: FieldAccess = ({ req }) => isAdmin({ req })
export const isReviewerField: FieldAccess = ({ req }) => isReviewer({ req })

export const canAccessCMS = ({ req }: { req: PayloadRequest }) =>
  can(cmsActor(req.user), 'cms:access')
export const manageMedia: Access = ({ req }) => can(cmsActor(req.user), 'media:manage')
export const deleteMedia: Access = ({ req }) => can(cmsActor(req.user), 'media:delete')

export const canReadArticle: Access = ({ req }) => {
  if (isReviewer({ req })) return true
  if (isAuthor({ req }) && req.user) {
    const where: Where = {
      or: [{ _status: { equals: 'published' } }, { owner: { equals: req.user.id } }],
    }
    return where
  }
  return { _status: { equals: 'published' } }
}

export const canReadArticleVersions: Access = ({ req }) => {
  if (isReviewer({ req })) return true
  if (isAuthor({ req }) && req.user) {
    return { 'version.owner': { equals: req.user.id } }
  }
  return false
}

// Aliases mantidos para compatibilidade com integrações existentes.
export const isEditor = isReviewer
export const publishedOrEditor = canReadArticle
